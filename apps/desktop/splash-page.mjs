import { readFileSync } from 'node:fs'

import { createWindowControlsMarkup, WINDOW_CONTROLS_CSS } from './window-controls.mjs'

const WORDMARK = 'Deepseek Harness'
const REVEAL_COLORS = ['#A97CF8', '#F38CB8', '#FDCC92']
const BAND_HALF = 17
const SWEEP_START = -BAND_HALF
const SWEEP_END = 100 + BAND_HALF

/**
 * The magicui dia-text-reveal gradient at a startup progress (0-100). The
 * sweep position maps linearly from `SWEEP_START` to `SWEEP_END`; the band's
 * leading region paints the settled text color (revealed glyphs), the band
 * itself paints the reveal colors, and the trailing region stays transparent
 * (glyphs that do not exist yet). Full progress collapses to a solid
 * text-colored gradient.
 *
 * @param {number} progress Startup progress in percent (0-100).
 * @param {{ textColor?: string }} [options] Gradient color for revealed text.
 * @returns {string} CSS `background-image` value for the wordmark.
 */
export function diaRevealGradient(progress, { textColor = 'var(--wordmark-ink)' } = {}) {
  const pos = SWEEP_START + (Math.max(0, Math.min(100, progress)) / 100) * (SWEEP_END - SWEEP_START)
  const bandStart = pos - BAND_HALF
  const bandEnd = pos + BAND_HALF

  if (bandStart >= 100) {
    return `linear-gradient(90deg, ${textColor}, ${textColor})`
  }

  const parts = []
  if (bandStart > 0) {
    parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`)
  }
  REVEAL_COLORS.forEach((color, index) => {
    const pct = bandStart + (index / (REVEAL_COLORS.length - 1)) * BAND_HALF * 2
    parts.push(`${color} ${pct.toFixed(2)}%`)
  })
  if (bandEnd < 100) {
    parts.push(`transparent ${bandEnd.toFixed(2)}%`, 'transparent 100%')
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

/**
 * Startup page for configured installs, playing the magicui dia-text-reveal:
 * the wordmark sits in the DOM from the start but its glyphs surface only as
 * the reveal band sweeps across them with the real startup progress — text
 * and color appear together, revealed glyphs settle into the text color, and
 * the full sweep means the backend is ready. The reveal is the only progress
 * display: no progress bar, no status copy.
 *
 * @param {{ cachedBackend?: boolean, frameless: boolean }} options
 * @returns {string} The splash page HTML.
 */
export function createSplashPage({ cachedBackend = false, frameless }) {
  const startupProgress = cachedBackend ? 62 : 18

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data:; style-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSH</title>
  <style>
    ${fontFaces()}
    :root {
      color-scheme: light dark;
      --ds-font-sans: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      --splash-bg: #f9f8f8;
      --splash-ink: #1e232c;
      --wordmark-ink: #152443;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --splash-bg: #101317;
        --splash-ink: rgba(255, 255, 255, .6);
        --wordmark-ink: #f2f4f8;
      }
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      font-family: var(--ds-font-sans);
      background: var(--splash-bg);
      color: var(--splash-ink);
    }
    a, button { -webkit-app-region: no-drag; }

    .splash {
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100vh; padding: 24px;
    }
    .wordmark {
      font-family: "Montserrat", var(--ds-font-sans);
      font-size: clamp(28px, 3.6vw, 40px);
      font-weight: 700;
      letter-spacing: -.01em;
      white-space: nowrap;
      line-height: 100%;
      transform: translateY(-2px);
      /* The dia reveal lives entirely in the background-image gradient the
         startup driver rewrites: glyphs outside the band are transparent, so
         unrevealed text simply does not exist yet. */
      color: transparent;
      -webkit-background-clip: text; background-clip: text;
      background-size: 100% 100%;
    }

    ${frameless ? `body::before {
      content: '';
      position: fixed;
      z-index: 40;
      inset: 0 320px auto 0;
      height: 32px;
      -webkit-app-region: drag;
    }
    ${WINDOW_CONTROLS_CSS}` : ''}
  </style>
</head>
<body>
  ${frameless ? createWindowControlsMarkup() : ''}
  <main class="splash">
    <div class="wordmark" id="startup-wordmark" role="img" aria-label="${WORDMARK}" style="background-image: ${diaRevealGradient(startupProgress)}">${WORDMARK}</div>
  </main>
</body>
</html>`
}

function fontFaces() {
  const faces = [
    { family: '"DM Sans"', weight: '400', file: 'dm-sans-400.woff2' },
    { family: '"DM Sans"', weight: '500', file: 'dm-sans-500.woff2' },
    { family: 'Montserrat', weight: '500', file: 'montserrat-500.woff2' },
    { family: 'Montserrat', weight: '700', file: 'montserrat-700.woff2' },
  ]
  let css = ''
  for (const face of faces) {
    try {
      const data = readFileSync(new URL(`./fonts/${face.file}`, import.meta.url)).toString('base64')
      css += `@font-face { font-family: ${face.family}; font-style: normal; font-weight: ${face.weight}; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); }\n    `
    } catch {
      /* fonts are optional */
    }
  }
  return css
}
