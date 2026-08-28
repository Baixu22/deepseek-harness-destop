import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Fail packaging when any build artifact is older than the source it was
// compiled from. Packaging entry points all funnel through stage-backend, so
// this gate runs for every package:variant and no stale bundle can be shipped
// by skipping the root build step.

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

// 1s tolerance: NTFS timestamps and copy rounding.
const FRESH_TOLERANCE_MS = 1000

function walkFiles(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(path, out)
    else out.push(path)
  }
  return out
}

function newestMtime(dir) {
  const files = walkFiles(dir, [])
  let newest = 0
  for (const file of files) newest = Math.max(newest, statSync(file).mtimeMs)
  return newest
}

// Per package: src must not be newer than its own lib. Also track the newest
// workspace source mtime overall for the web-bundle check below.
const stalePackages = []
let workspaceSrcNewest = 0
const packagesRoot = resolve(repositoryRoot, 'packages')
for (const group of readdirSync(packagesRoot, { withFileTypes: true })) {
  if (!group.isDirectory()) continue
  const groupDir = join(packagesRoot, group.name)
  for (const pkg of readdirSync(groupDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    const pkgDir = join(groupDir, pkg.name)
    const srcDir = join(pkgDir, 'src')
    const libDir = join(pkgDir, 'lib')
    if (!existsSync(srcDir)) continue
    const srcNewest = newestMtime(srcDir)
    workspaceSrcNewest = Math.max(workspaceSrcNewest, srcNewest)
    if (!existsSync(libDir)) continue
    if (walkFiles(srcDir, []).length === 0) continue
    const libNewest = newestMtime(libDir)
    if (srcNewest > libNewest + FRESH_TOLERANCE_MS) {
      stalePackages.push({ pkg: `${group.name}/${pkg.name}`, lagMinutes: Math.round((srcNewest - libNewest) / 60000) })
    }
  }
}

// Global: web bundle must not be older than any client/host source or the
// web app's own sources.
const webDist = resolve(repositoryRoot, 'apps', 'web', 'dist')
const webSrc = resolve(repositoryRoot, 'apps', 'web', 'src')
if (!existsSync(webDist)) {
  console.error('freshness gate: apps/web/dist is missing; run: pnpm run build')
  process.exit(1)
}
const webDistNewest = newestMtime(webDist)
const webSrcNewest = existsSync(webSrc) ? newestMtime(webSrc) : 0
const allSrcNewest = Math.max(workspaceSrcNewest, webSrcNewest)
if (allSrcNewest > webDistNewest + FRESH_TOLERANCE_MS) {
  console.error(
    `freshness gate: apps/web/dist is ${Math.round((allSrcNewest - webDistNewest) / 60000)} minute(s) older than the newest workspace source`,
  )
  process.exit(1)
}

if (stalePackages.length > 0) {
  console.error('freshness gate: these packages have lib/ older than src/ (stale build artifacts):')
  for (const entry of stalePackages) {
    console.error(`  packages/${entry.pkg}  lib lags ${entry.lagMinutes} minute(s)`)
  }
  console.error('run: pnpm run build  (then package again)')
  process.exit(1)
}

console.log('freshness gate: all artifacts are current')
