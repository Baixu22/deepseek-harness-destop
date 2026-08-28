/**
 * WorkspaceBrowser spacing contract, asserted against the CSS text on disk:
 * row fills share the shell's trailing inset, the stable scrollbar counts
 * inside it, and flat and grouped views keep their intended rhythm. The
 * search palette styles live in their own SearchPalette.module.css.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/WorkspaceBrowser.module.css', import.meta.url)), 'utf8')
const rowsCss = readFileSync(fileURLToPath(new URL('../src/client/rows/Rows.module.css', import.meta.url)), 'utf8')

/**
 * Declarations of one selector rule, keyed by property with whitespace collapsed.
 * Declaration order and trailing semicolons are normalized away.
 * @param selector - one exact selector, including a leading dot for local classes.
 * @returns the rule's declarations, or undefined when no such rule exists.
 */
function declarationsFrom(source: string, selector: string): Map<string, string> | undefined {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

const declarations = (selector: string): Map<string, string> | undefined => declarationsFrom(css, selector)
const rowDeclarations = (selector: string): Map<string, string> | undefined => declarationsFrom(rowsCss, selector)

describe('WorkspaceBrowser.module.css list', () => {
  const root = declarations('.root')
  const listArea = declarations('.listArea')
  const list = declarations('.list')

  it('is the scrolling region', () => {
    expect(list).toBeDefined()
    expect(list!.get('overflow-y')).toBe('auto')
  })

  it('counts the themed scrollbar inside the shell trailing inset', () => {
    expect(root?.get('--dsh-session-list-edge-inset')).toBe('var(--dsh-sidebar-inline-padding)')
    expect(root?.get('--dsh-session-list-scrollbar-width')).toBe('8px')
    expect(root?.get('--dsh-session-list-scrollbar-offset')).toBe('2px')
    expect(root?.get('padding-right')).toBe('var(--dsh-session-list-edge-inset)')
    expect(listArea?.get('margin-left')).toBe('-4px')
    expect(listArea?.get('padding-left')).toBe('4px')
    expect(listArea?.get('margin-right')).toBe('calc(-1 * var(--dsh-session-list-edge-inset))')
    expect(declarations('.fade')?.get('right')).toBe('var(--dsh-session-list-edge-inset)')
    expect(list?.get('margin-right')).toBe('var(--dsh-session-list-scrollbar-offset)')
    expect(list?.get('margin-left')).toBe('-4px')
    expect(list?.get('padding-left')).toBe('4px')
    expect(list?.get('padding-right')).toBe([
      'calc(',
      'var(--dsh-session-list-edge-inset)',
      '- var(--dsh-session-list-scrollbar-width)',
      '- var(--dsh-session-list-scrollbar-offset)',
      ')',
    ].join(' '))
    expect(declarations('.list::-webkit-scrollbar')).toBeUndefined()
  })

  it('reserves the scrollbar whether or not the list overflows', () => {
    expect(list!.get('scrollbar-gutter')).toBe('stable')
  })

  it('joins a Workspace to its first child while keeping compact sibling and group gaps', () => {
    expect(declarations('.flatList > * + *')?.get('margin-top')).toBe('2px')
    expect(declarations('.groupSection > * + *')?.get('margin-top')).toBe('2px')
    expect(declarations('.groupSection > *:first-child + *')?.get('margin-top')).toBe('0')
    expect(declarations('.groupSection + .groupSection')?.get('margin-top')).toBe('4px')
  })

  it('draws drag targets as a leading chevron joined to the insertion line', () => {
    const listTopMarker = declarations('.listTopDropIndicator')
    const workspaceMarker = declarations('.workspaceDropBefore::before')
    const sessionMarker = rowDeclarations('.sessionRow.dropBefore::before')
    expect(listTopMarker?.get('top')).toBe('-8px')
    expect(listTopMarker?.get('left')).toBe('0')
    expect(workspaceMarker?.get('left')).toBe('0')
    expect(sessionMarker?.get('left')).toBe('0')
    for (const marker of [listTopMarker, workspaceMarker, sessionMarker]) {
      expect(marker?.get('height')).toBe('12px')
      expect(marker?.get('background')).not.toContain('radial-gradient')
      expect(marker?.get('background')).toContain('55deg')
      expect(marker?.get('background')).toContain('125deg')
      expect(marker?.get('background')).toContain('calc(50% - 1px) calc(50% + 1px)')
      expect(marker?.get('background')).toContain('0 0 / 5px 7px')
      expect(marker?.get('background')).toContain('0 5px / 5px 7px')
      expect(marker?.get('background')).toContain('4px 5px / calc(100% - 4px) 2px')
    }
  })

  it('keeps the compact fade, overflow control, and row heights', () => {
    expect(declarations('.fade')?.get('height')).toBe('24px')
    expect(declarations('.sessionOverflowButton')?.get('height')).toBe('28px')
    expect(rowDeclarations('.projectRow')?.get('height')).toBe('34px')
    // The session card sizes to its content (title header), unlike the
    // fixed-height workspace row above it.
    expect(rowDeclarations('.sessionRow')?.get('height')).toBe('auto')
    expect(rowDeclarations('.sessionRow')?.get('padding')).toBe('6px 8px')
    expect(rowDeclarations('.nestedSessionRow')?.get('padding-left')).toBe('30px')
    expect(rowDeclarations('.flatSessionRowWithoutStatus .title')?.get('margin-left')).toBe('0')
    expect(rowDeclarations('.searchResultRow')?.get('min-height')).toBe('48px')
    expect(rowDeclarations('.sessionRow.selected')?.get('background'))
      .toBe('var(--dsw-alias-interactive-bg-hover)')
  })

  it('pins both rail controls to the shared left anchor during the column slide', () => {
    expect(declarations('.rail .sectionHeader')?.get('justify-content')).toBe('flex-start')
    expect(declarations('.rail .iconButton')?.get('width')).toBe('36px')
    expect(declarations('.rail .search')?.get('width')).toBe('36px')
  })

  it('separates the pinned section from the workspace groups below it', () => {
    const section = declarations('.pinnedSection')
    expect(section?.get('border-bottom')).toBe('1px solid var(--dsw-alias-border-l1)')
    expect(section?.get('margin-bottom')).toBe('8px')
    // The 10px row gap reserves room for the stacked under-layers so they
    // never overlap the next card or the first Workspace header.
    expect(declarations('.pinnedSection .sessionRow + .sessionRow')?.get('margin-top')).toBe('10px')
    expect(declarations('.pinnedHeader')?.get('font-size')).toBe('11px')
  })
})

describe('Rows.module.css marquee and pinned card', () => {
  it('moves only the inner marquee span, exactly its measured overflow', () => {
    expect(rowDeclarations('.titleText')?.get('display')).toBe('inline-block')
    expect(rowDeclarations('.titleText')?.get('white-space')).toBe('nowrap')
    // Resolve against the base sheet only: the reduced-motion override (same
    // selector) would overwrite the declaration in the naive rule scan.
    const base = rowsCss.slice(0, rowsCss.indexOf('@media'))
    const marquee = declarationsFrom(base, '.sessionRow:hover .titleText')
    expect(marquee?.get('animation')).toContain('title-marquee')
    expect(marquee?.get('animation')).toContain('var(--marquee-duration, 2s)')
    // One iteration with a forwards fill: the hover runs the title once to
    // its end and holds there — no alternate bounce-back loop.
    expect(marquee?.get('animation')).toContain('forwards')
    expect(marquee?.get('animation')).not.toContain('alternate')
    // The travel is the measured variable set from Rows.tsx, never a fixed
    // distance — the text cannot scroll past its own clipped box. (The
    // helper splits keyframes into per-frame rules; the marquee's `to` frame
    // is the only `to` in the file.)
    expect(rowDeclarations('to')?.get('transform')).toBe('translateX(var(--marquee-shift, 0px))')
    expect(rowDeclarations('.sessionRow:hover .title')?.get('text-overflow')).toBe('clip')
  })

  it('renders the pinned card as one complete elevated cell with verbs visible', () => {
    const card = rowDeclarations('.sessionRow.pinned')
    expect(card?.get('position')).toBe('relative')
    expect(card?.get('background')).toBe('var(--dsw-alias-bg-layer-2)')
    // One full border on all four sides — never the stacked under-layer
    // slivers, which read as broken half-frames under the row.
    expect(card?.get('border')).toBe('1px solid var(--dsw-alias-border-l1)')
    expect(card?.get('animation')).toContain('pin-in')
    expect(rowDeclarations('.pinned .rowActions')?.get('display')).toBe('inline-flex')
    expect(rowDeclarations('.pinned .time')?.get('display')).toBe('none')
    expect(rowDeclarations('.pinBadge')?.get('color')).toBe('var(--dsw-alias-state-business-primary)')
  })

  it('stills the marquee and the pinned entrance under prefers-reduced-motion', () => {
    const block = rowsCss.replace(/\/[\s\S]*?\*\//g, ' ').match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/)
    expect(block?.[0]).toContain('.titleText')
    expect(block?.[0]).toContain('.sessionRow')
  })
})
