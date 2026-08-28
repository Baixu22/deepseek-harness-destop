import { existsSync, mkdirSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { calibratePluginResolutionLinks, profilePluginDirectories } from '../plugin-links.mjs'

const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-links-'))

afterAll(() => {
  rmSync(home, { recursive: true, force: true })
})

/** Isolated per-test plugin area so anchors never overlap between tests. */
function stageArea(name: string) {
  const pluginsRoot = join(home, name, 'plugins')
  mkdirSync(pluginsRoot, { recursive: true })
  return pluginsRoot
}

function stagePlugin(pluginsRoot: string, name: string) {
  const plugin = join(pluginsRoot, name)
  mkdirSync(join(plugin, 'lib'), { recursive: true })
  writeFileSync(join(plugin, 'lib', 'index.js'), 'export {}\n', 'utf8')
  return plugin
}

function stageBackend(root: string) {
  const scope = join(root, 'node_modules', '@deepseek-ai', 'dsh-settings')
  mkdirSync(scope, { recursive: true })
  writeFileSync(join(scope, 'package.json'), '{"name":"@deepseek-ai/dsh-settings"}\n', 'utf8')
  return scope
}

function stageProfile(name: string, dependencies: Record<string, string>) {
  const profile = join(home, 'profiles', name)
  mkdirSync(profile, { recursive: true })
  writeFileSync(join(profile, 'package.json'), JSON.stringify({ dependencies }), 'utf8')
}

function anchorFor(plugin: string) {
  return join(plugin, '..', 'node_modules', '@deepseek-ai')
}

describe('profile plugin discovery', () => {
  it('collects existing absolute and profile-relative link targets once', () => {
    const pluginsRoot = stageArea('discovery')
    const plugin = stagePlugin(pluginsRoot, 'dsh-context')
    const missing = join(pluginsRoot, 'dsh-ghost')
    stageProfile('web', {
      'dsh-context': `link:${plugin.replaceAll('\\', '//')}`,
      'dsh-ghost': `link:${missing.replaceAll('\\', '//')}`,
    })
    stageProfile('empty', { marked: '^9.0.0' })

    expect(profilePluginDirectories(home)).toEqual([plugin])
  })
})

describe('plugin resolution calibration', () => {
  it('anchors profile plugins at the staged backend so their bare imports resolve', async () => {
    const pluginsRoot = stageArea('anchor')
    const plugin = stagePlugin(pluginsRoot, 'dsh-context')
    stageProfile('web', { 'dsh-context': `link:${plugin}` })
    const backendRoot = join(home, 'backend-1')
    const scope = stageBackend(backendRoot)

    const calibrated = await calibratePluginResolutionLinks({ dshHome: home, backendRoot })

    expect(calibrated).toEqual([anchorFor(plugin)])
    expect(existsSync(join(anchorFor(plugin), 'dsh-settings', 'package.json'))).toBe(true)
    expect(realpathSync(anchorFor(plugin))).toBe(realpathSync(join(scope, '..')))
  })

  it('repoints a stale anchor at the new backend version after an upgrade', async () => {
    const pluginsRoot = stageArea('upgrade')
    const plugin = stagePlugin(pluginsRoot, 'dsh-turn-tidy')
    stageProfile('web', { 'dsh-turn-tidy': `link:${plugin}` })
    const oldRoot = join(home, 'backend-1')
    const newRoot = join(home, 'backend-2')
    stageBackend(oldRoot)
    const newScope = stageBackend(newRoot)

    await calibratePluginResolutionLinks({ dshHome: home, backendRoot: oldRoot })
    const calibrated = await calibratePluginResolutionLinks({ dshHome: home, backendRoot: newRoot })

    expect(calibrated).toEqual([anchorFor(plugin)])
    expect(realpathSync(anchorFor(plugin))).toBe(realpathSync(join(newScope, '..')))
  })

  it('keeps a real directory at the anchor and skips already-correct links', async () => {
    // A and B live in different parent directories: plugins in one parent
    // share a single anchor, so a user directory there would cover both.
    const pluginsRoot = stageArea('preserve')
    const otherRoot = stageArea('preserve-other')
    const pluginA = stagePlugin(pluginsRoot, 'dsh-hover-hold')
    const pluginB = stagePlugin(otherRoot, 'dsh-prompt-rail')
    stageProfile('web', {
      'dsh-hover-hold': `link:${pluginA}`,
      'dsh-prompt-rail': `link:${pluginB}`,
    })
    const backendRoot = join(home, 'backend-1')
    stageBackend(backendRoot)
    mkdirSync(anchorFor(pluginB), { recursive: true })
    const userMarker = join(anchorFor(pluginB), 'user-data.txt')
    writeFileSync(userMarker, 'keep me', 'utf8')

    await calibratePluginResolutionLinks({ dshHome: home, backendRoot })
    const calibrated = await calibratePluginResolutionLinks({ dshHome: home, backendRoot })

    expect(calibrated).toEqual([anchorFor(pluginA)])
    expect(readFileSync(userMarker, 'utf8')).toBe('keep me')
  })

  it('does nothing without a staged backend scope directory', async () => {
    expect(await calibratePluginResolutionLinks({
      dshHome: home,
      backendRoot: join(home, 'backend-absent'),
    })).toEqual([])
  })
})
