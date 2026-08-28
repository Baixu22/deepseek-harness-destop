/** Strict per-session header/body content inserted into the resident conversation layout. */

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import clsx from 'clsx'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSessionHeaderSlotProps, ConversationSessionSlotProps,
} from '../contract/slots.ts'
import type { ViewTab } from '../contract/views.ts'
import css from './ConversationRoot.module.css'

/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps

/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps

interface Breadcrumb {
  readonly id: SessionId
  readonly displayTitle: string
  readonly subagent: boolean
}

const DEFAULT_VIEW_ID = 'chat'

/**
 * The pill's transition window: the incoming heavy view mounts only after it
 * settles, so the mount cannot stall the animation.
 */
const VIEW_MOUNT_DEFER_MS = 220

/** Resolve by id and keep stale persisted selections on the stable Chat fallback. */
function resolveActiveView(tabs: readonly ViewTab[], selectedId: string | null): ViewTab | undefined {
  const requestedId = selectedId ?? DEFAULT_VIEW_ID
  return tabs.find(view => view.id === requestedId)
    ?? tabs.find(view => view.id === DEFAULT_VIEW_ID)
}

function deriveAncestry(list: SessionListState, id: SessionId): readonly Breadcrumb[] {
  const chain: Breadcrumb[] = []
  const seen = new Set<SessionId>()
  let cursor: SessionId | undefined = id
  while (cursor !== undefined) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const summary: SessionSummary | undefined = list.byId[cursor]
    if (summary === undefined) break
    chain.unshift({
      id: summary.id,
      displayTitle: summary.displayTitle,
      subagent: summary.origin === 'subagent',
    })
    if (summary.origin !== 'subagent') break
    cursor = summary.parentId
  }
  return chain
}

function equalBreadcrumbs(left: readonly Breadcrumb[], right: readonly Breadcrumb[]): boolean {
  return left.length === right.length
    && left.every((item, index) => {
      const other = right.at(index)
      return other !== undefined && item.id === other.id && item.displayTitle === other.displayTitle
    })
}

interface TabStripProps {
  tabs: readonly ViewTab[]
  activeId: string | undefined
  onSelect: (id: string) => void
}

/**
 * Segmented tab strip with a single compositor-animated highlight pill.
 *
 * One pill element is owned by the strip (not per-tab): on selection change it
 * translates/scales to the active trigger's measured box with a CSS transform
 * — compositor-only, no layout animation, no per-click re-measure of the
 * Motion layout engine. Geometry is re-derived only when the active tab or the
 * tab set changes (ResizeObserver covers label font/width drift).
 */
function TabStrip({ tabs, activeId, onSelect }: TabStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const [pill, setPill] = useState({ x: 0, w: 0 })

  const measure = (): void => {
    const strip = stripRef.current
    const trigger = activeId === undefined ? undefined : triggerRefs.current.get(activeId)
    if (strip === null || trigger === undefined) { setPill({ x: 0, w: 0 }); return }
    setPill({ x: trigger.offsetLeft, w: trigger.offsetWidth })
  }

  useEffect(measure)
  useEffect(() => {
    const strip = stripRef.current
    if (strip === null) return
    // jsdom (the unit lane) implements no ResizeObserver; every browser gets
    // the subscription, and the render-time measure already covers the box.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(strip)
    return () => { ro.disconnect() }
    // measure identity is stable enough per render; re-subscribe on activeId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, tabs.length])

  return (
    <div ref={stripRef} className={css.tabs} role="tablist">
      {pill.w > 0 && (
        <span
          className={css.tabIndicator}
          style={{ '--tab-pill-x': `${pill.x}px`, width: pill.w } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {tabs.map((viewTab) => {
        const selected = viewTab.id === activeId
        return (
          <button
            key={viewTab.id}
            ref={(el) => { if (el !== null) triggerRefs.current.set(viewTab.id, el); else triggerRefs.current.delete(viewTab.id) }}
            type="button"
            role="tab"
            aria-selected={selected}
            className={clsx(css.tab, selected && css.tabActive)}
            onClick={() => { onSelect(viewTab.id) }}
          >
            <span className={css.tabLabel}>{viewTab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
/**
 * Renders Session header chrome above the resident conversation scrollport.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns the hidden blank-session header or visible title and tabs.
 */
export function ConversationSessionHeader({
  sessionId, useSession, useSessions, useStore, actions,
  renderSlot, views, open, rename, t,
}: ConversationSessionHeaderProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const hideChrome = blank && composerPhase === 'blank'

  // Inline rename: double-click the current crumb to swap the title for an
  // input; commit on Enter/blur, cancel on Escape. The runtime `rename` verb
  // is the single source of truth (the session list re-projects the accepted
  // title through its own event stream).
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  // The accepted title lands through the list's event re-projection a round
  // trip later; presenting the committed text immediately stops the
  // input-to-title swap from flashing the old title first.
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const ancestryTitle = ancestry.at(-1)?.displayTitle ?? sessionId
  const currentTitle = pendingTitle ?? ancestryTitle

  useEffect(() => {
    if (pendingTitle !== null && pendingTitle === ancestryTitle) setPendingTitle(null)
  }, [pendingTitle, ancestryTitle])

  const startRename = (): void => {
    setDraft(currentTitle)
    setRenaming(true)
  }
  const commitRename = (): void => {
    setRenaming(false)
    const next = draft.trim()
    if (next !== '' && next !== currentTitle) {
      setPendingTitle(next)
      void rename(sessionId, next).catch(() => { setPendingTitle(null) })
    }
  }
  const cancelRename = (): void => { setRenaming(false) }

  useEffect(() => {
    if (!renaming) return
    renameRef.current?.focus()
    renameRef.current?.select()
  }, [renaming])

  return (
    <header
      className={clsx(css.header, hideChrome && css.headerHidden)}
      aria-hidden={hideChrome || undefined}
    >
      {!hideChrome && (
        <>
          <div className={css.titleRow}>
            <div className={css.titleCluster}>
              <nav className={css.crumbs} aria-label={t('session.hierarchy')}>
                {ancestry.map((summary, index) => {
                  const last = index === ancestry.length - 1
                  const isCurrentLeaf = last && !summary.subagent
                  const title = renaming && last
                    ? (
                      // The invisible crumb ghost keeps the row's layout box
                      // while the input overlays it: the swap never shifts the
                      // header, whatever the input's width.
                      <span className={css.crumbRename}>
                        <button
                          type="button"
                          className={clsx(css.crumb, css.crumbGhost)}
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          {summary.displayTitle}
                        </button>
                        <input
                          ref={renameRef}
                          className={css.crumbInput}
                          value={draft}
                          maxLength={120}
                          aria-label={t('session.rename.aria')}
                          onChange={(e) => { setDraft(e.target.value) }}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') cancelRename()
                          }}
                        />
                      </span>
                    )
                    : (
                      <button
                        type="button"
                        className={clsx(
                          css.crumb,
                          summary.subagent && css.crumbSubagent,
                          last && css.crumbCurrent,
                          isCurrentLeaf && css.crumbEditable,
                        )}
                        title={isCurrentLeaf ? t('session.rename.title') : undefined}
                        onClick={() => { if (!last) open(summary.id) }}
                        onDoubleClick={isCurrentLeaf ? startRename : undefined}
                      >
                        {summary.displayTitle}
                      </button>
                    )
                  const lineage = last || summary.subagent
                  const lineageOwner = {
                    lineageSessionId: summary.id,
                    displayTitle: summary.displayTitle,
                    ...last ? {} : { openTitle: () => { open(summary.id) } },
                  }
                  return (
                    <span key={summary.id} className={css.crumbSeg}>
                      {index > 0 && <span className={css.crumbSep}>/</span>}
                      {lineage
                        ? summary.subagent
                          ? renderSlot(
                            'conversation.session.header.lineage',
                            lineageOwner,
                            { fallback: title },
                          )
                          : (
                            <>
                              {title}
                              {renderSlot(
                                'conversation.session.header.lineage',
                                lineageOwner,
                                { fallback: null },
                              )}
                            </>
                          )
                        : title}
                    </span>
                  )
                })}
                {ancestry.length === 0 && <span className={css.crumbCurrent}>{sessionId}</span>}
              </nav>
              <div className={css.headerActions}>
                {renderSlot('conversation.session.header.actions', {})}
              </div>
            </div>
            <div className={css.headerUtilities}>
              {renderSlot('conversation.session.header.utilities', {})}
            </div>
          </div>
          {tabs.length > 1 && (
            <TabStrip tabs={tabs} activeId={active?.id} onSelect={actions.setView} />
          )}
        </>
      )}
    </header>
  )
}
/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft mirrored while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export function ConversationSession({
  sessionId, useSession, useInput, inputActions, useStore, actions,
  renderSlot, views, bindDraftMirror, releaseSessionImages,
}: ConversationSessionProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const inputState = useInput(s => s)
  const storedDraft = useStore(s => s.draft)
  // `?? null`: persisted snapshots from before the inspect field rehydrate without it.
  const inspect = useStore(s => s.inspect ?? null)
  // View switches defer the heavy mount (TrajectoryView derives its layout
  // and search index from the whole session ledger): the urgent render moves
  // the tab pill and keeps the outgoing view on screen, then a timer commits
  // the incoming view once the pill's transition settles. A timer owns the
  // switch instead of a deferred render because continuous urgent updates — a
  // streaming session re-renders this component per event — postpone a
  // deferred render indefinitely, leaving the clicked tab switched in the
  // pill only.
  const [renderViewId, setRenderViewId] = useState<string | undefined>(active?.id)
  useEffect(() => {
    if (active?.id === renderViewId) return
    const timer = setTimeout(() => { setRenderViewId(active?.id) }, VIEW_MOUNT_DEFER_MS)
    return () => { clearTimeout(timer) }
  }, [active?.id, renderViewId])
  const renderView = tabs.find(view => view.id === renderViewId) ?? active

  useEffect(() => {
    if (inputState.draft === '' && storedDraft !== '') inputActions.setDraft(storedDraft)
    const unmirror = bindDraftMirror(actions.setDraft)
    return () => { unmirror() }
    // Mount-only (deps pinned to inputActions): later store writes come from
    // the machine mirror, not this seed effect.
  }, [inputActions])

  useEffect(() => () => {
    releaseSessionImages(sessionId)
  }, [releaseSessionImages, sessionId])

  if (blank && composerPhase === 'blank') return null
  return (
    <div className={css.viewArea}>
      {renderView !== undefined && renderSlot('conversation.view', {
        inspect,
        onInspectDone: () => { actions.setInspect(null) },
      }, { only: renderView.id })}
    </div>
  )
}
