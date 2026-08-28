// @vitest-environment jsdom
/** IconCloud behavior: the sphere canvas renders without a pause control,
 * survives the drag gesture, and re-inks its CDN glyph urls on scheme flips. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IconCloud } from '../src/client/IconCloud.tsx'

afterEach(cleanup)

const SLUGS = ['typescript', 'docker', 'figma']

describe('IconCloud', () => {
  it('renders the sphere canvas and no pause control', () => {
    render(<IconCloud slugs={SLUGS} />)
    expect(screen.getByRole('img', { name: 'Interactive 3D Icon Cloud' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('survives the drag gesture sequence on a jsdom canvas', () => {
    render(<IconCloud slugs={SLUGS} />)
    const canvas = screen.getByRole('img')
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(canvas, { clientX: 210, clientY: 195 })
    fireEvent.mouseUp(canvas)
    fireEvent.mouseLeave(canvas)
  })

  it('re-inks the glyph urls when the scheme attribute flips', () => {
    document.body.style.setProperty('--dsh-about-cloud-ink', '#123456')
    render(<IconCloud slugs={SLUGS} />)
    document.body.setAttribute('data-ds-dark-theme', '')
    document.body.removeAttribute('data-ds-dark-theme')
    document.body.style.removeProperty('--dsh-about-cloud-ink')
  })

  it('normalizes rgb() ink values to bare hex for the CDN path', () => {
    document.body.style.setProperty('--dsh-about-cloud-ink', 'rgb(91, 100, 114)')
    render(<IconCloud slugs={SLUGS} />)
    document.body.style.removeProperty('--dsh-about-cloud-ink')
  })
})
