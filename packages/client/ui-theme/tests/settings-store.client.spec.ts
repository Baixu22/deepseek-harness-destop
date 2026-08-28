/** Appearance row store: snapshot-mirror action and the revision guard. */
import { describe, expect, it } from 'vitest'
import { createAppearanceRowStore, createThemeTogglerStore } from '../src/client/settings-store.ts'

describe('createAppearanceRowStore', () => {
  it('init shape: system preference with revision at -1', () => {
    const store = createAppearanceRowStore().create()
    expect(store.getSnapshot()).toEqual({ preference: 'system', revision: -1 })
  })

  it('sync mirrors the preference and advances the revision', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 0)
    expect(store.getSnapshot()).toEqual({ preference: 'dark', revision: 0 })
    store.actions.sync('light', 2)
    expect(store.getSnapshot().preference).toBe('light')
    expect(store.getSnapshot().revision).toBe(2)
  })

  it('revision guard drops stale and duplicate writes', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 3)
    store.actions.sync('system', 2)
    store.actions.sync('system', 3)
    expect(store.getSnapshot().preference).toBe('dark')
    expect(store.getSnapshot().revision).toBe(3)
  })
})

describe('createThemeTogglerStore', () => {
  it('init shape: light scheme with revision at -1', () => {
    const store = createThemeTogglerStore().create()
    expect(store.getSnapshot()).toEqual({ scheme: 'light', revision: -1 })
  })

  it('sync mirrors the resolved scheme and advances the revision', () => {
    const store = createThemeTogglerStore().create()
    store.actions.sync('dark', 0)
    expect(store.getSnapshot()).toEqual({ scheme: 'dark', revision: 0 })
    store.actions.sync('light', 2)
    expect(store.getSnapshot().scheme).toBe('light')
    expect(store.getSnapshot().revision).toBe(2)
  })

  it('revision guard drops stale and duplicate writes', () => {
    const store = createThemeTogglerStore().create()
    store.actions.sync('dark', 3)
    store.actions.sync('light', 2)
    store.actions.sync('light', 3)
    expect(store.getSnapshot().scheme).toBe('dark')
    expect(store.getSnapshot().revision).toBe(3)
  })
})
