/** Runtime files that must exist before a packaged backend can be reused or archived. */
export const BACKEND_RUNTIME_PATHS = [
  ['node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'],
  ['node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json'],
  ['node_modules', 'yaml', 'dist', 'index.js'],
]

/**
 * Fixed loopback port for the Electron-owned backend. The Web client keys
 * localStorage (persisted session selection, sidebar prefs) to the page
 * origin, and session logs store absolute terminal WebSocket URLs: a random
 * port made both unreachable after every restart. Override with
 * `DSH_DESKTOP_BACKEND_PORT` when the port is taken.
 */
export const BACKEND_PORT = Number(process.env.DSH_DESKTOP_BACKEND_PORT) || 3180

/**
 * Build the Electron-owned backend command without allowing `dsh web` to open an external browser.
 * @param {string} entry - Absolute path to the packaged dsh CLI entry.
 * @returns {string[]} Electron Node-mode arguments for the loopback Web host.
 */
export function backendLaunchArguments(entry, extra = []) {
  return ['--expose-internals', ...extra, entry, 'web', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--no-open']
}
