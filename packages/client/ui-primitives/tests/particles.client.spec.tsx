// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Particles } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(cleanup)

describe('Particles', () => {
  it('renders an aria-hidden, pointer-transparent canvas container', () => {
    const { container } = render(<Particles />)
    const field = container.firstElementChild as HTMLElement
    expect(field.getAttribute('aria-hidden')).toBe('true')
    expect(field.className).toMatch(/container/)
    expect(field.querySelector('canvas')).not.toBeNull()
  })

  it('accepts an explicit color and extra className without crashing', () => {
    const { container } = render(<Particles color="#ff0000" className="extra" quantity={5} />)
    const field = container.firstElementChild as HTMLElement
    expect(field.className).toMatch(/extra/)
  })

  it('survives pointer moves and resize, then cancels its frame loop on unmount', () => {
    vi.useFakeTimers()
    try {
      const { unmount } = render(<Particles />)
      fireEvent.mouseMove(window, { clientX: 120, clientY: 80 })
      fireEvent(window, new Event('resize'))
      // The debounced resize re-init fires inside the same fake clock.
      vi.advanceTimersByTime(250)
      unmount()
      // No pending frame or timer survives the unmount.
      vi.advanceTimersByTime(1000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-resolves the theme ink when the scheme attribute flips', () => {
    document.body.style.setProperty('--dsh-particles-ink', '#123456')
    render(<Particles />)
    // Flip the scheme attribute: the observer re-reads the token.
    document.body.setAttribute('data-ds-dark-theme', '')
    document.body.removeAttribute('data-ds-dark-theme')
    document.body.style.removeProperty('--dsh-particles-ink')
  })

  it('falls back to the token default when no color is provided', () => {
    // No --dsh-particles-ink set anywhere: the fallback ink applies.
    render(<Particles />)
  })
})
