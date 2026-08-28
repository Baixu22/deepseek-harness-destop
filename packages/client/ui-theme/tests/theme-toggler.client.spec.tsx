// @vitest-environment jsdom
/** Sidebar-foot theme toggler: rounded-rect row control when wide, the rail
 * circle when collapsed, the hover hint through the shared Tooltip primitive,
 * and the instant flip path where the View Transitions API is absent. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { ThemeToggler } from '../src/client/ThemeToggler.tsx'
import type { ThemeTogglerComponentProps } from '../src/client/ThemeToggler.tsx'
import { createThemeTogglerStore } from '../src/client/settings-store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

function mountToggler(scheme: 'light' | 'dark' = 'light', wide = true) {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createThemeTogglerStore().create()
  store.actions.sync(scheme, 0)
  const setTheme = vi.fn()
  render(<ThemeToggler {...({
    wide,
    setTheme,
    useStore: bindSnapshotSelector(store),
    t: (key: keyof typeof en) => en[key],
  } as unknown as ThemeTogglerComponentProps)} />)
  return setTheme
}

describe('ThemeToggler', () => {
  it('renders a rounded-rect row control when wide and a circle on the rail', () => {
    const wide = mountToggler('light', true)
    expect(wide).toBeDefined()
    const wideButton = screen.getByRole('button', { name: en['toggle.aria'] })
    expect(wideButton.className).not.toContain('rail')
    cleanup()

    mountToggler('light', false)
    expect(screen.getByRole('button', { name: en['toggle.aria'] }).className).toContain('rail')
  })

  it('carries its hint through the shared Tooltip primitive', () => {
    mountToggler('light', true)
    expect(screen.getByRole('button').hasAttribute('title')).toBe(false)
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip').textContent).toBe(en['toggle.aria'])
  })

  it('flips light to dark instantly without the View Transitions API', () => {
    const setTheme = mountToggler('light', true)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('flips dark back to light', () => {
    const setTheme = mountToggler('dark', true)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
