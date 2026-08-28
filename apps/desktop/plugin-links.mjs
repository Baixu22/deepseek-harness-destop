import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize } from 'node:path'

const SCOPE_DIRECTORY = '@deepseek-ai'
const LINK_PROTOCOL = 'link:'

/**
 * Plugin directories linked into any dsh profile under the harness home.
 * Profiles register community plugins as `link:` dependencies whose target is
 * absolute or relative to the profile directory.
 * @param {string} dshHome - Harness home directory (`DSH_HOME` or `~/.dsh`).
 * @returns {string[]} Absolute plugin directories that exist on disk.
 */
export function profilePluginDirectories(dshHome) {
  const profilesDirectory = join(dshHome, 'profiles')
  if (!existsSync(profilesDirectory)) return []
  const plugins = []
  for (const entry of readdirSync(profilesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(profilesDirectory, entry.name, 'package.json')
    if (!existsSync(manifestPath)) continue
    let dependencies
    try {
      dependencies = JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies ?? {}
    } catch {
      // A damaged profile manifest has no linkable plugins; the backend still
      // reports its own loader failure for that profile.
      continue
    }
    for (const value of Object.values(dependencies)) {
      if (typeof value !== 'string' || !value.startsWith(LINK_PROTOCOL)) continue
      const raw = value.slice(LINK_PROTOCOL.length)
      const resolved = isAbsolute(raw) ? normalize(raw) : join(profilesDirectory, entry.name, raw)
      if (!plugins.includes(resolved) && existsSync(resolved)) plugins.push(resolved)
    }
  }
  return plugins
}

/**
 * Restate the plugins' `@deepseek-ai` resolution anchor against this app
 * version's staged backend. Profile plugins bare-import workspace packages
 * (`@deepseek-ai/dsh-settings`, ...), which Node resolves from the plugin's
 * physical location — a directory chain with no node_modules into the
 * versioned backend directory. An app update renames that directory, so a
 * stale anchor would break every plugin after upgrading; calibrating on each
 * packaged startup keeps the anchor covering the live backend. A real
 * directory at the anchor is user data and is left untouched.
 * @param {{ dshHome: string, backendRoot: string }} options - Harness home and
 *   the staged backend root for this app version.
 * @returns {Promise<string[]>} Anchors that now resolve against `backendRoot`.
 */
export async function calibratePluginResolutionLinks({ dshHome, backendRoot }) {
  const target = join(backendRoot, 'node_modules', SCOPE_DIRECTORY)
  if (!existsSync(target)) return []
  const expectedTarget = realpathSync(target)
  const calibrated = []
  for (const plugin of profilePluginDirectories(dshHome)) {
    const anchor = join(dirname(plugin), 'node_modules', SCOPE_DIRECTORY)
    if (calibrated.includes(anchor)) continue
    let stats
    try {
      stats = await lstat(anchor)
    } catch {
      /* absent anchor: create it below */
    }
    if (stats !== undefined) {
      if (!stats.isSymbolicLink()) continue
      if (realpathSync(anchor) === expectedTarget) {
        calibrated.push(anchor)
        continue
      }
      await rm(anchor)
    }
    await mkdir(dirname(anchor), { recursive: true })
    await symlink(expectedTarget, anchor, 'junction')
    calibrated.push(anchor)
  }
  return calibrated
}
