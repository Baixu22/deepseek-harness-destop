import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { BACKEND_RUNTIME_PATHS } from '../backend-contract.mjs'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(desktopRoot, '..', '..')
const output = resolve(repositoryRoot, 'desktop-backend')
const builtFrontend = resolve(repositoryRoot, 'apps', 'web', 'dist')
const welcomeBackground = resolve(
  repositoryRoot,
  'packages',
  'client',
  'ui-settings-models',
  'src',
  'client',
  'assets',
  'deepseek-welcome-background.png',
)
const deployedFrontend = resolve(
  output,
  'node_modules',
  '@deepseek-ai',
  'dsh-web-frontend',
  'dist',
)
const clientOverlays = [
  ['ui-layout', '@deepseek-ai/dsh-client-ui-layout'],
  ['ui-settings-models', '@deepseek-ai/dsh-client-ui-settings-models'],
  ['ui-directory-picker-native', '@deepseek-ai/dsh-client-ui-directory-picker-native'],
  ['ui-workspace', '@deepseek-ai/dsh-client-ui-workspace'],
]
const pnpmEntry = process.env.npm_execpath

if (!pnpmEntry) throw new Error('stage-backend must be run through pnpm')

// Stale-artifact gate: abort packaging when any lib/ or the web bundle is
// older than its sources, so an outdated UI can never reach an installer.
const freshnessGate = spawnSync(process.execPath, [resolve(desktopRoot, 'scripts', 'verify-fresh-artifacts.mjs')], {
  stdio: 'inherit',
})
if (freshnessGate.error) throw freshnessGate.error
if (freshnessGate.status !== 0) {
  throw new Error(`packaging aborted: build artifacts are stale (exit ${String(freshnessGate.status)}); run 'pnpm run build' first`)
}

rmSync(output, { recursive: true, force: true })
// `package-import-method=copy` is required: pnpm's default hard-link imports
// collide on this volume's reused NTFS file IDs, and node-tar's create-time
// hard-link dedup then archives one package's lib content under another
// package's name — the extracted backend fails to load its plugin tree.
const result = spawnSync(
  process.execPath,
  [
    pnpmEntry,
    '--config.inject-workspace-packages=true',
    '--config.node-linker=hoisted',
    '--config.package-import-method=copy',
    '--config.strict-dep-builds=false',
    '--filter',
    '@baixu22/dsh-desktop-backend',
    'deploy',
    '--prod',
    output,
  ],
  { cwd: repositoryRoot, stdio: 'inherit' },
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

const missingRuntimePaths = BACKEND_RUNTIME_PATHS
  .map(segments => resolve(output, ...segments))
  .filter(path => !existsSync(path))
if (missingRuntimePaths.length > 0) {
  throw new Error(`deployed desktop backend is missing required runtime files:\n${missingRuntimePaths.join('\n')}`)
}

// The archive must never carry hard-link entries: create-time dedup trusts
// file IDs, and a reused file ID silently archives one package's content
// under another package's name. Detach every linked file so the deployment
// tree holds only independent inodes before archiving.
const pendingDirectories = [output]
while (pendingDirectories.length > 0) {
  const directory = pendingDirectories.pop()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      pendingDirectories.push(path)
      continue
    }
    if (statSync(path).nlink > 1) {
      const content = readFileSync(path)
      unlinkSync(path)
      writeFileSync(path, content)
    }
  }
}
let multiLinkFiles = 0
pendingDirectories.push(output)
while (pendingDirectories.length > 0) {
  const directory = pendingDirectories.pop()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) pendingDirectories.push(path)
    else if (statSync(path).nlink > 1) multiLinkFiles++
  }
}
if (multiLinkFiles > 0) {
  throw new Error(
    `${multiLinkFiles} deployed files still share a hard link; the backend archive would corrupt their contents`,
  )
}

if (!existsSync(resolve(builtFrontend, 'index.html'))) {
  throw new Error('desktop frontend overlay is missing; run the Web build before staging')
}
if (!existsSync(resolve(output, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'package.json'))) {
  throw new Error('deployed backend is missing @deepseek-ai/dsh-web-frontend')
}
rmSync(deployedFrontend, { recursive: true, force: true })
cpSync(builtFrontend, deployedFrontend, { recursive: true })
mkdirSync(resolve(deployedFrontend, 'assets'), { recursive: true })
copyFileSync(welcomeBackground, resolve(deployedFrontend, 'assets', 'deepseek-welcome-background.png'))

for (const [workspaceName, packageName] of clientOverlays) {
  const builtPackage = resolve(repositoryRoot, 'packages', 'client', workspaceName, 'lib')
  const deployedPackageRoot = resolve(output, 'node_modules', ...packageName.split('/'))
  if (!existsSync(resolve(builtPackage, 'client.js'))) {
    throw new Error(`desktop client overlay is missing for ${packageName}; run the client build before staging`)
  }
  if (!existsSync(resolve(deployedPackageRoot, 'package.json'))) {
    throw new Error(`deployed backend is missing ${packageName}`)
  }
  rmSync(resolve(deployedPackageRoot, 'lib'), { recursive: true, force: true })
  cpSync(builtPackage, resolve(deployedPackageRoot, 'lib'), { recursive: true })
}

// The deployment tree is the shipped artifact: electron-builder packs it as
// an extraResource directory and the NSIS installer unpacks it, so the app
// never pays extraction latency on startup.
