// @vitest-environment jsdom
// motion caches the prefers-reduced-motion query the first time any consumer
// renders, so this suite lives alone: the matchMedia mock is installed before
// the first useReducedMotion call anywhere in the file.
import { describe, expect, it, vi } from 'vitest'

window.matchMedia = vi.fn().mockReturnValue({
  matches: true, media: '(prefers-reduced-motion)', onchange: null,
  addEventListener: vi.fn(), removeEventListener: vi.fn(),
  addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
}) as typeof window.matchMedia

const { MotionGlobalConfig } = await import('motion')
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react')
const { Menu, Particles, Tooltip } = await import('@deepseek-ai/dsh-client-ui-primitives')

MotionGlobalConfig.skipAnimations = true

describe('reduced motion', () => {
  it('drops the spring for a reduced-motion user', () => {
    render(
      <Tooltip label="Calm">
        <button type="button">anchor</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByText('anchor'))
    // The fade-only variant carries no scale/slide transform at rest.
    const plate = screen.getByRole('tooltip').firstElementChild as HTMLElement
    expect(plate.style.transform).toBe('')
    cleanup()
  })

  it('fades the Menu open instead of springing it', () => {
    render(
      <Menu open anchor={<span>trigger</span>} items={[{ id: 'a', label: 'Alpha' }]} onSelect={() => {}} onClose={() => {}} />,
    )
    // The fade-only variant carries no scale transform at rest.
    expect(screen.getByRole('menu').style.transform).toBe('')
    cleanup()
  })

  it('renders nothing for the Particles field', () => {
    const { container } = render(<Particles />)
    expect(container.firstElementChild).toBeNull()
    cleanup()
  })
})
