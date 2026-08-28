/* Animated theme toggler (magicui AnimatedThemeToggler port): the sidebar
   foot control left of the settings trigger that flips light/dark with a
   circular View-Transition reveal expanding from the button. The resolved
   scheme arrives through the toggler store (the apply-world listener is the
   only writer); the write rides the theme service's setTheme, whose publish
   is synchronous, so the startViewTransition callback snapshots the NEW
   theme. Browsers without the View Transitions API flip instantly. */

import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import clsx from 'clsx'
import { IconDarkOutline16, IconLightOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ctx.settingsScope Context merge (the Appearance row's).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createThemeTogglerStore } from './settings-store.ts'
import css from './ThemeToggler.module.css'

/** Reveal duration; the VT group duration CSS variable follows it. */
const DURATION_MS = 400

/** Injected business face: the preference write. */
export interface ThemeTogglerInjected {
  /** Switch to an explicit light/dark preference. */
  setTheme: (id: 'light' | 'dark') => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type ThemeTogglerComponentProps =
  PropsRuntime<'settings.trigger.trailing'> & PropsStore<ReturnType<typeof createThemeTogglerStore>>
  & PropsLocale<'settings.theme'> & ThemeTogglerInjected

/**
 * Render the theme toggle button.
 * @param props - composed slot props (apply wires the store and write face).
 * @returns the toggler button.
 */
export function ThemeToggler({ wide, t, setTheme, useStore }: ThemeTogglerComponentProps) {
  const scheme = useStore(s => s.scheme)
  const isDark = scheme === 'dark'
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const transitioning = useRef(false)
  const activeAnim = useRef<Animation | null>(null)

  // Unmount mid-reveal: cancel the clip animation and retract the VT
  // markers the toggle pinned on the root element.
  useEffect(() => () => {
    activeAnim.current?.cancel()
    const root = document.documentElement
    if (root.dataset.dshThemeVt !== 'active') return
    delete root.dataset.dshThemeVt
    root.style.removeProperty('--dsh-theme-vt-duration')
    root.style.removeProperty('--dsh-theme-vt-clip-from')
  }, [])

  const toggle = (): void => {
    if (transitioning.current) return
    const next: 'light' | 'dark' = isDark ? 'light' : 'dark'
    const applyTheme = (): void => { setTheme(next) }
    if (typeof document.startViewTransition !== 'function') {
      applyTheme()
      return
    }
    // The reveal expands from the button centre to the farthest viewport
    // corner; percentages resolve against the snapshot reference box.
    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = buttonRef.current?.getBoundingClientRect()
    /* v8 ignore next -- the click comes off the button, so the ref is
       attached; the viewport-centre fallback only guards a detached ref. */
    const x = rect === undefined ? vw / 2 : rect.left + rect.width / 2
    /* v8 ignore next -- see the x fallback above. */
    const y = rect === undefined ? vh / 2 : rect.top + rect.height / 2
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))
    const at = `at ${(x / vw) * 100}% ${(y / vh) * 100}%`
    const clipFrom = `circle(0% ${at})`
    // circle() percentage radii resolve against hypot(w, h) / sqrt(2).
    const clipTo = `circle(${(maxRadius / (Math.hypot(vw, vh) / Math.SQRT2)) * 100}% ${at})`

    const root = document.documentElement
    root.dataset.dshThemeVt = 'active'
    root.style.setProperty('--dsh-theme-vt-duration', `${DURATION_MS}ms`)
    // Pin the collapsed clip via CSS so no unclipped new-theme frame paints
    // between snapshot and the ready-then JS animation.
    root.style.setProperty('--dsh-theme-vt-clip-from', clipFrom)
    transitioning.current = true
    const transition = document.startViewTransition(() => { flushSync(applyTheme) })
    const cleanup = (): void => {
      transitioning.current = false
      delete root.dataset.dshThemeVt
      root.style.removeProperty('--dsh-theme-vt-duration')
      root.style.removeProperty('--dsh-theme-vt-clip-from')
    }
    transition.finished.finally(cleanup).catch(() => {})
    void transition.ready.then(() => {
      activeAnim.current = root.animate(
        { clipPath: [clipFrom, clipTo] },
        { duration: DURATION_MS, easing: 'ease-in-out', fill: 'forwards', pseudoElement: '::view-transition-new(root)' },
      )
    }).catch(() => {})
  }

  return (
    <Tooltip label={t('toggle.aria')} side="top" delayMs={500}>
      <button
        ref={buttonRef}
        type="button"
        className={clsx(css.toggler, !wide && css.rail)}
        aria-label={t('toggle.aria')}
        onClick={toggle}
      >
        {isDark ? <IconLightOutline16 size={16} /> : <IconDarkOutline16 size={16} />}
      </button>
    </Tooltip>
  )
}
