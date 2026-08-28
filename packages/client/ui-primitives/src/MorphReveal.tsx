import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import css from './MorphReveal.module.css'

/** Reveal/hide window; must match the CSS transition length in the module. */
const MORPH_MS = 520

export interface MorphRevealProps {
  /** Whether the body is expanded; toggles the height morph in place. */
  open: boolean
  children: ReactNode
  className?: string | undefined
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Render one height-morph expand body: a clipping panel animates between 0
 * and the measured content height while the content blurs out/in — the
 * header row above never moves and content below is pushed by the growing
 * height. The motion language matches the long-text card morph (520ms
 * decelerate, blur crossfade). The panel height is driven imperatively, not
 * through component state: a CSS transition only starts when the property
 * changes across a rendered frame, so each toggle locks the current
 * rendered height as the start value, forces a style recalc, then retargets
 * one frame later — a retarget inside the same frame's rAF stage would run
 * before that recalc and a closed body would jump from `auto` (not
 * interpolable) straight to 0px. Toggling mid-flight restarts from the
 * current rendered height instead of replaying from an end state.
 *
 * The panel stays mounted once rendered; a settled closed body keeps 0px
 * inline height. Callers legitimately unmount the body content when closed
 * (e.g. a folded tree group derives an empty session list), so the last
 * expanded children stay rendered through the collapse animation and are
 * dropped once the height settles.
 * @param props - controlled open state and the body content.
 * @returns the morph container.
 */
export function MorphReveal({ open, children, className }: MorphRevealProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const prevOpen = useRef(open)
  // Last children committed while open (null before the first expansion, so a
  // row born collapsed renders no body at all); replayed through the collapse
  // animation because the caller may already pass an emptied list.
  const openChildren = useRef<ReactNode>(null)
  if (open) openChildren.current = children
  // Collapsed and settled: the snapshot has been played out and can go.
  const [retired, setRetired] = useState(false)
  useLayoutEffect(() => {
    const wasOpen = prevOpen.current
    prevOpen.current = open
    if (open === wasOpen) return
    const wrap = wrapRef.current
    if (!wrap) return
    if (open) setRetired(false)
    if (prefersReducedMotion()) {
      wrap.style.height = open ? '' : '0px'
      if (!open) setRetired(true)
      return
    }
    // A body that renders with no inline height (freshly opened, or settled
    // open) must grow from zero when opening; one already carrying an inline
    // height (mid-flight reverse, settled closed) restarts from its current
    // rendered height.
    const from = open && wrap.style.height === '' ? 0 : wrap.getBoundingClientRect().height
    // Lock the start value in this frame's style recalc so the retarget one
    // frame later reads as a change across frames and starts the transition.
    wrap.style.height = `${from}px`
    void wrap.offsetHeight
    let done = false
    const settle = (): void => {
      if (done) return
      done = true
      if (open) {
        // Clear the inline height so a settled open body rides the content
        // height and streaming growth needs no re-measure.
        wrap.style.height = ''
      } else {
        wrap.style.height = '0px'
        setRetired(true)
      }
    }
    // The expand target reads the rendered height with the inline value
    // cleared, not scrollHeight: inner max-height scroll containers (card
    // bodies) clamp the drawn height below the content height, so settling on
    // the drawn height keeps the handoff to the auto state seamless.
    const expandTarget = (): number => {
      const locked = wrap.style.height
      wrap.style.height = ''
      const natural = wrap.getBoundingClientRect().height
      wrap.style.height = locked
      void wrap.offsetHeight
      return natural
    }
    let raf = 0
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        wrap.style.height = open ? `${expandTarget()}px` : '0px'
      })
    })
    const timer = window.setTimeout(settle, MORPH_MS + 50)
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== wrap || event.propertyName !== 'height') return
      settle()
    }
    wrap.addEventListener('transitionend', onEnd)
    return () => {
      done = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      wrap.removeEventListener('transitionend', onEnd)
    }
  }, [open])
  return (
    <div
      ref={wrapRef}
      className={clsx(css.morph, open && css.open, className)}
      aria-hidden={!open || undefined}
    >
      <div className={css.clip}>{open ? children : retired ? null : openChildren.current}</div>
    </div>
  )
}
