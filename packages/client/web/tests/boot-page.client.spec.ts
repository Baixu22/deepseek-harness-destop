// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BootPage, BOOT_REVEAL_MIN_MS } from '../src/boot-page.ts'

afterEach(() => { document.body.innerHTML = '' })

function mount() {
  const el = document.createElement('div')
  document.body.append(el)
  return { el, page: new BootPage(el) }
}

describe('BootPage', () => {
  it('draws the loading skeleton before any plugin state arrives', () => {
    const { el } = mount()
    expect(el.firstElementChild?.getAttribute('data-dsh-boot')).toBe('')
    expect(el.textContent).toContain('DeepSeek Harness')
    expect(el.textContent).toContain('Loading plugins…')
  })

  it('sweeps the brand reveal from real loader progress', () => {
    const { el, page } = mount()
    page.setTotal(2)
    const reveal = el.querySelector<HTMLElement>('[data-dsh-boot-reveal]')
    expect(reveal?.dataset.dshBootRatio).toBe('0.000')
    page.setState('a', 'active')
    expect(reveal?.dataset.dshBootRatio).toBe('0.500')
    page.setState('b', 'loading')
    expect(el.querySelector('[data-dsh-boot-reveal]')).toBe(reveal)
    expect(reveal?.dataset.dshBootRatio).toBe('0.500')
    page.setState('b', 'active')
    expect(reveal?.dataset.dshBootRatio).toBe('1.000')
    expect(el.textContent).toContain('Loading plugins…')
    expect(el.textContent).not.toContain('Failed to load plugins')
  })

  it('lists failed entries', () => {
    const { el, page } = mount()
    page.setState('@deepseek-ai/dsh-client-ui-layout', 'failed')
    page.setState('ok', 'active')
    page.setState('@deepseek-ai/dsh-client-ui-tool', 'failed')
    expect(el.textContent).toContain('@deepseek-ai/dsh-client-ui-layout')
    expect(el.textContent).toContain('@deepseek-ai/dsh-client-ui-tool')
    expect(el.textContent).not.toContain('ok')
    expect(el.textContent).not.toContain('Loading plugins…')
  })

  it('shows the complete sweep report', () => {
    const { el, page } = mount()
    const report = 'web boot: 1 entry did not activate\nx: pending (waiting for service: y)'
    page.fail(report)
    page.setState('a', 'active')
    expect(el.textContent).toContain(report)
    expect(el.textContent).not.toContain('Loading plugins…')
  })

  it('detaches on disposal', () => {
    const { el, page } = mount()
    page.dispose()
    expect(el.childNodes).toHaveLength(0)
  })

  it('settles the reveal synchronously once the roster completes without animation frames', async () => {
    const { page } = mount()
    page.setTotal(1)
    page.setState('a', 'active')
    await page.awaitReveal()
    await page.awaitReveal()
  })

  it('settles the reveal on failure even without loader progress', async () => {
    const { page } = mount()
    page.fail('web boot: host preparation failed')
    await page.awaitReveal()
  })

  it('plays the full reveal for at least the minimum duration when loading settles fast', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.useFakeTimers()
    try {
      const { el, page } = mount()
      page.setTotal(1)
      page.setState('a', 'active')
      let settled = false
      void page.awaitReveal().then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(BOOT_REVEAL_MIN_MS - 200)
      expect(settled).toBe(false)
      expect(el.querySelector('[data-dsh-boot-reveal]')).not.toBeNull()
      await vi.advanceTimersByTimeAsync(400)
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('cancels the playback and settles reveal waiters on disposal', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.useFakeTimers()
    try {
      const { page } = mount()
      page.setTotal(1)
      let settled = false
      void page.awaitReveal().then(() => { settled = true })
      page.dispose()
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})
