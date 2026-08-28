import { describe, expect, it } from 'vitest'

import { createSplashPage, diaRevealGradient } from '../splash-page.mjs'

describe('desktop splash page', () => {
  it('renders the dia-text-reveal wordmark as the progress display', () => {
    const html = createSplashPage({ frameless: true })

    expect(html).toContain('id="startup-wordmark"')
    expect(html).toContain('>Deepseek Harness</div>')
    // The initial band sits at the default progress (18): revealed glyphs
    // carry the settled text color, the band paints the reveal colors, and
    // unrevealed glyphs stay transparent.
    expect(html).toContain(`style="background-image: ${diaRevealGradient(18)}"`)
    expect(html).toContain('#A97CF8')
    expect(html).toContain('#F38CB8')
    expect(html).toContain('#FDCC92')
    expect(html).toContain('transparent 100%')
    expect(html).toContain('background-clip: text')
    expect(html).toContain('color: transparent')
    // The wordmark reveal IS the progress display: no separate progress bar,
    // no status copy — the reveal sweep is the only thing on the page.
    expect(html).not.toContain('id="startup-progress"')
    expect(html).not.toContain('progress-pulse')
    expect(html).not.toContain('id="startup-status"')
    expect(html).not.toContain('id="startup-detail"')
    expect(html).not.toContain('正在')
    expect(html).toContain('id="dsh-window-controls"')
    expect(html).toContain('-webkit-app-region: drag')
  })

  it('reveals glyphs left of the band and keeps glyphs right of it transparent', () => {
    const gradient = diaRevealGradient(50)

    // Leading region paints the settled ink; trailing region stays
    // transparent, so the text grows with the colored band.
    expect(gradient).toContain('var(--wordmark-ink) 0%')
    expect(gradient).toMatch(/transparent [\d.]+%, transparent 100%\)$/)
    for (const color of ['#A97CF8', '#F38CB8', '#FDCC92']) {
      expect(gradient).toContain(color)
    }
  })

  it('settles the wordmark to the solid text color at full progress', () => {
    expect(diaRevealGradient(100)).toBe('linear-gradient(90deg, var(--wordmark-ink), var(--wordmark-ink))')
  })

  it('adapts to the OS color scheme with distinct light and dark palettes', () => {
    const html = createSplashPage({ frameless: true })

    expect(html).toContain('color-scheme: light dark')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('--splash-bg: #f9f8f8')
    expect(html).toContain('--splash-bg: #101317')
    expect(html).toContain('--wordmark-ink: #152443')
    expect(html).toContain('--wordmark-ink: #f2f4f8')
  })

  it('keeps native-frame platforms free of duplicate in-app controls', () => {
    const html = createSplashPage({ frameless: false })

    expect(html).not.toContain('id="dsh-window-controls"')
    expect(html).not.toContain('-webkit-app-region: drag')
  })

  it('starts the band further along when the packaged backend is already cached', () => {
    const html = createSplashPage({ cachedBackend: true, frameless: true })

    expect(html).toContain(`style="background-image: ${diaRevealGradient(62)}"`)
    expect(html).not.toContain('首次启动可能需要约一分钟。')
  })
})
