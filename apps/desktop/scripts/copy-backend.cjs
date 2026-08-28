// electron-builder hard-codes a filter that drops the top-level
// `node_modules` of every extraResources copy, which would gut the backend
// deployment tree. This hook copies the tree after packing instead, so the
// installer carries the complete backend runtime and the app never extracts
// anything at startup.
const { cpSync, existsSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')

const REQUIRED_BACKEND_ENTRY = ['node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js']

/** @param {import('app-builder-lib').AfterPackContext} context */
exports.default = async function afterPack(context) {
  // apps/desktop/scripts -> repo root -> desktop-backend
  const source = resolve(__dirname, '..', '..', '..', 'desktop-backend')
  const destination = join(context.appOutDir, 'resources', 'backend')
  if (!existsSync(join(source, ...REQUIRED_BACKEND_ENTRY))) {
    throw new Error(`staged desktop backend is missing ${REQUIRED_BACKEND_ENTRY.join('/')}; run stage-backend first`)
  }
  rmSync(destination, { recursive: true, force: true })
  cpSync(source, destination, { recursive: true })
}
