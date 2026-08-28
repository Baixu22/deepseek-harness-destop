/** Long-text collapse card: the document chip shared by the composer (a
 * pasted long draft collapses into it, keeping the full text in the machine
 * so Send submits it verbatim) and user bubbles (a long message stays
 * collapsed until expanded to its markdown rendering). Geometry, colors, and
 * both glyphs are transcribed from the DeepSeek Chat reference card. */

import css from './LongTextCard.module.css'

/** Drafts and messages at or above this many characters take the collapsed
 * card presentation; shorter text renders inline as before. */
export const LONG_TEXT_MIN_CHARS = 1000

/** Whether this text is long enough to collapse into a card. */
export function isLongText(text: string): boolean {
  return text.length >= LONG_TEXT_MIN_CHARS
}

/** Title line of the card: the first non-empty line, ellipsized by CSS. */
function longTextTitle(text: string): string {
  return text.split('\n').map(row => row.trim()).find(row => row !== '') ?? text.trim()
}

/** Document glyph: a blue (#418CFF) page with a folded top-right corner and
 * three white text lines (the third short), exactly the reference icon. */
function LongTextDocIcon() {
  return (
    <svg className={css.icon} width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M8.48924 28H19.5108C21.6479 28 22.7165 28 23.5594 27.6509C24.6833 27.1853 25.5762 26.2924 26.0417 25.1685C26.3909 24.3256 26.3909 23.257 26.3909 21.1199V8.79443C26.3909 8.32877 26.3909 8.09593 26.3471 7.87507C26.2887 7.58058 26.173 7.30042 26.0067 7.05048C25.882 6.86303 25.7177 6.69799 25.3893 6.36792L20.0611 1.01354C19.7304 0.681235 19.5651 0.515081 19.3769 0.38885C19.126 0.220541 18.8443 0.103463 18.5481 0.0443412C18.3259 0 18.0915 0 17.6226 0H8.48924C6.35209 0 5.28351 0 4.4406 0.349145C3.31672 0.814671 2.4238 1.70759 1.95828 2.83147C1.60913 3.67438 1.60913 4.74296 1.60913 6.88011V21.1199C1.60913 23.257 1.60913 24.3256 1.95828 25.1685C2.4238 26.2924 3.31672 27.1853 4.4406 27.6509C5.28351 28 6.35209 28 8.48924 28Z" fill="#418CFF" />
      <path d="M26.3909 7.37445L19.0525 0V3.77445C19.0525 4.89271 19.0525 5.45184 19.2352 5.89289C19.4788 6.48096 19.946 6.94818 20.5341 7.19176C20.9751 7.37445 21.5342 7.37445 22.6525 7.37445H26.3909Z" fill="white" fillOpacity=".7" />
      <path d="M8.10132 12.6846H19.8948" stroke="white" strokeWidth="1.6" />
      <path d="M8.10132 16.4688H19.8948" stroke="white" strokeWidth="1.6" />
      <path d="M8.10132 20.252H16.0199" stroke="white" strokeWidth="1.6" />
    </svg>
  )
}

/** Down-left arrow (↙) leading the eye to the input box below the card. */
function LongTextArrowIcon() {
  return (
    <svg className={css.actionArrow} width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 3 3 13M9 13H3V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Close (✕) glyph for the optional dismiss control. */
function LongTextCloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M10.6074 4.40278L8.00975 6.99973L10.6074 9.59739L9.59736 10.6074L6.9997 8.00978L4.40274 10.6074L3.3927 9.59739L5.98966 6.99973L3.3927 4.40278L4.40274 3.39273L6.9997 5.98969L9.59736 3.39273L10.6074 4.40278Z" fill="currentColor" />
    </svg>
  )
}

/**
 * The collapsed long-text chip: icon, first-line title, and one underlined
 * action row; the whole card body is the action target. A dismiss (✕) control
 * appears at the top-right on hover only when `onDismiss` is supplied. No
 * native tooltip is set: the collapsed text is long, so a `title` would dump
 * the whole raw draft on hover.
 * @param props - text to summarize in the title, action copy, click handler,
 * and an optional discard handler.
 * @returns the card.
 */
export function LongTextCard({ text, actionLabel, onAction, onDismiss }: {
  text: string
  actionLabel: string
  onAction: () => void
  onDismiss?: () => void
}) {
  return (
    <div className={css.card}>
      <button type="button" className={css.hit} onClick={onAction}>
        <LongTextDocIcon />
        <span className={css.body}>
          <span className={css.title}>{longTextTitle(text)}</span>
          <span className={css.action}>
            <LongTextArrowIcon />
            <span className={css.actionLabel}>{actionLabel}</span>
          </span>
        </span>
      </button>
      {onDismiss !== undefined && (
        <button
          type="button"
          className={css.close}
          aria-label={actionLabel}
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
        >
          <LongTextCloseIcon />
        </button>
      )}
    </div>
  )
}
