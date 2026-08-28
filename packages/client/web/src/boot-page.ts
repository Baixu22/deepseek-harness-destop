/**
 * Framework-free boot page and failure report. It remains available when a
 * client plugin fails because React arrives only with the UI renderer.
 *
 * The loading indicator is a brand "DeepSeek Harness" dia-style text reveal:
 * a gradient band sweeps left-to-right across the wordmark and the sweep
 * position tracks real loader progress (activated entries over roster
 * total), so the reveal never reports completion before the roster settles.
 * After the roster settles the playback plays out to a minimum duration, so a
 * fast boot renders the complete reveal at a proportionally faster pace
 * instead of flashing past, while a slow boot keeps tracking real progress
 * and hands over as soon as it arrives.
 * @module @deepseek-ai/dsh-client-web/src/boot-page
 */
import type { LoaderEntryState } from './loader-status.ts'
import css from './boot-page.module.css'

/** Half width of the moving gradient band, in percent (dia-text-reveal). */
const BAND_HALF = 17
/** Minimum playback duration of a full reveal sweep, in milliseconds. */
export const BOOT_REVEAL_MIN_MS = 1500
/** Smoothing tick interval of the reveal playback loop, in milliseconds. */
const REVEAL_TICK_MS = 16
/** Brand palette sampled across the moving band. */
const SWEEP_COLORS = ['#8ab4ff', '#4d6bfe', '#7c5cff', '#2ea8ff', '#4d6bfe']
/** Theme-aware color for the revealed portion of the wordmark. */
const SWEEP_TEXT = 'var(--dsw-alias-label-primary, var(--dsh-boot-label-primary))'

/** Build the dia sweep gradient for a position in [-BAND_HALF, 100 + BAND_HALF]. */
function sweepGradient(pos: number): string {
  const bandStart = pos - BAND_HALF
  const bandEnd = pos + BAND_HALF
  if (bandStart >= 100) return `linear-gradient(90deg, ${SWEEP_TEXT}, ${SWEEP_TEXT})`
  const parts: string[] = []
  if (bandStart > 0) parts.push(`${SWEEP_TEXT} 0%`, `${SWEEP_TEXT} ${bandStart.toFixed(2)}%`)
  SWEEP_COLORS.forEach((color, index) => {
    const pct = bandStart + (index / (SWEEP_COLORS.length - 1)) * BAND_HALF * 2
    parts.push(`${color} ${pct.toFixed(2)}%`)
  })
  if (bandEnd < 100) parts.push(`transparent ${bandEnd.toFixed(2)}%`, 'transparent 100%')
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

/** Create a div with one module class and optional text. */
function div(className: string | undefined, text?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className ?? ''
  if (text !== undefined) el.textContent = text
  return el
}

/** Kernel-owned page mounted below the application's root element. */
export class BootPage {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  private readonly wordmark: HTMLDivElement
  private readonly hint: HTMLDivElement
  private readonly states = new Map<string, LoaderEntryState>()
  private readonly active = new Set<string>()
  private total = 0
  private ratio = 0
  private shown = 0
  /** Wall-clock playback origin for the minimum-duration sweep floor. */
  private readonly startedAt = Date.now()
  private frame: ReturnType<typeof setTimeout> | null = null
  private failure: string | undefined
  private revealSettled = false
  private revealResolve: (() => void) | undefined

  /**
   * Build and attach the boot page.
   * @param container - Application mount point.
   */
  constructor(container: HTMLElement) {
    this.root = div(css.boot)
    this.root.dataset.dshBoot = ''
    this.card = div(css.card)
    this.wordmark = div(css.wordmark, 'DeepSeek Harness')
    this.wordmark.dataset.dshBootReveal = ''
    this.hint = div(css.hint, 'Loading plugins…')
    this.card.append(this.wordmark, this.hint)
    this.root.append(this.card)
    container.append(this.root)
    this.updateProgress()
  }

  /**
   * Set the number of loader entries represented by the reveal sweep.
   * @param total - Complete boot roster size.
   */
  setTotal(total: number): void {
    this.total = total
    this.updateProgress()
  }

  /**
   * Project one loader entry's fiber state.
   * @param id - Loader entry name.
   * @param state - Projected fiber state.
   */
  setState(id: string, state: LoaderEntryState): void {
    this.states.set(id, state)
    if (state === 'active') this.active.add(id)
    this.updateProgress()
    this.render()
  }

  /**
   * Display the boot failure report.
   * @param message - Failure report text.
   */
  fail(message: string): void {
    this.failure = message
    this.settleReveal()
    this.render()
  }

  /**
   * Wait for the reveal sweep to play out; the mount point is handed over
   * only afterwards so the animation is never cut mid-flight.
   * @returns Resolves on sweep completion, boot failure, or disposal.
   */
  awaitReveal(): Promise<void> {
    if (this.revealSettled) return Promise.resolve()
    return new Promise((resolve) => { this.revealResolve = resolve })
  }

  /** Detach the page before or after the UI renderer takes the mount point. */
  dispose(): void {
    if (this.frame !== null) clearTimeout(this.frame)
    this.frame = null
    this.settleReveal()
    this.root.remove()
  }

  /**
   * Project real loader progress onto the sweep target. Synchronous so the
   * ratio is observable even without animation frames (e.g. jsdom).
   */
  private updateProgress(): void {
    this.ratio = this.total === 0 ? 0 : Math.min(this.active.size / this.total, 1)
    this.wordmark.dataset.dshBootRatio = this.ratio.toFixed(3)
    if (typeof requestAnimationFrame === 'function') this.startPlayback()
    else {
      this.shown = this.ratio
      this.applySweep()
      if (this.shown >= 1) this.settleReveal()
    }
  }

  /**
   * Play the sweep toward the event-driven target. setTimeout, not
   * requestAnimationFrame: rAF frames never run in occluded tabs, which would
   * strand a backgrounded reload on the boot page forever.
   */
  private startPlayback(): void {
    if (this.frame !== null) return
    const step = (): void => {
      this.frame = null
      const diff = this.ratio - this.shown
      if (this.ratio >= 1) {
        // Loading settled: play the remainder out to the minimum playback
        // duration, so a fast boot gets the full reveal at a faster pace
        // instead of a flash. A boot slower than the minimum already tracked
        // real progress and finishes here immediately.
        const floor = Math.min((Date.now() - this.startedAt) / BOOT_REVEAL_MIN_MS, 1)
        this.shown = floor >= 1 ? 1 : Math.max(this.shown + diff * 0.12, floor)
      } else {
        this.shown = this.shown + diff * 0.12
      }
      this.applySweep()
      if (this.shown >= 1) {
        this.settleReveal()
        return
      }
      this.frame = setTimeout(step, REVEAL_TICK_MS)
    }
    this.frame = setTimeout(step, REVEAL_TICK_MS)
  }

  /** Resolve reveal waiters exactly once. */
  private settleReveal(): void {
    if (this.revealSettled) return
    this.revealSettled = true
    this.revealResolve?.()
  }

  private applySweep(): void {
    this.wordmark.style.backgroundImage = sweepGradient(-BAND_HALF + this.shown * (100 + 2 * BAND_HALF))
  }

  /** Redraw the state-dependent content below the wordmark. */
  private render(): void {
    const failed = [...this.states].filter(([, state]) => state === 'failed').map(([id]) => id)
    if (this.failure === undefined && failed.length === 0) {
      if (css.solid !== undefined) this.wordmark.classList.remove(css.solid)
      if (this.hint.parentElement !== this.card) {
        this.card.replaceChildren(this.wordmark, this.hint)
      }
      return
    }
    if (css.solid !== undefined) this.wordmark.classList.add(css.solid)
    const report = div(css.failed)
    report.append(div(css.failedTitle, 'Failed to load plugins'))
    for (const id of failed) report.append(div(css.failedItem, id))
    if (this.failure !== undefined) report.append(div(css.failedItem, this.failure))
    this.card.replaceChildren(this.wordmark, report)
  }
}
