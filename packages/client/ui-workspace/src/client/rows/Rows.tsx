/**
 * Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
 * all data and callbacks arrive via props. Hover swaps (folder->chevron,
 * time->ellipsis, action buttons) are CSS-only. Row ... menus are visual-only
 * except workspace Rename/Delete and session Rename/Fork/Archive; the session
 * and workspace hover cards are suppressed while a menu is open.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, type HTMLMotionProps } from 'motion/react'
import clsx from 'clsx'
import {
  HoverCard, IconArchiveOutline20, IconBranchOutline16, IconEditOutline16,
  IconEllipsisOutline16, IconFolderClose16, IconFolderOpen16, IconFolderOpenOutline16, IconPinOutline16,
  IconPlusOutline16, IconTrashOutline16, IconTriangleRightFill14, Menu, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { abbreviateHomePath, type SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type { GroupNode, SearchResultNode, SessionNode } from '../tree.ts'
import { relativeTime } from '../tree.ts'
import css from './Rows.module.css'

/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t']

/** Row display title: blank rows show the localized New Session label. */
function displayTitle(node: SessionNode, t: RowTranslate): string {
  return node.blank ? t('session.new') : node.title
}

/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
function timeLabel(updatedAt: number, now: number, t: RowTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/** Marquee speed: the title scrolls at 40px per second, with a floor so short
 *  overflows still read as a deliberate motion. */
const MARQUEE_PX_PER_S = 40
const MARQUEE_MIN_MS = 1200

/**
 * Hover-marquee plan for a session title wider than its cell: the exact
 * overflow distance (the animation's full travel, so the text never moves
 * past its own box) and the linear duration that distance implies.
 * @returns undefined when the title fits (no marquee).
 */
export function titleMarquee(scrollWidth: number, clientWidth: number): { shift: number; durationMs: number } | undefined {
  const shift = scrollWidth - clientWidth
  if (shift <= 0) return undefined
  return { shift, durationMs: Math.max(MARQUEE_MIN_MS, Math.round((shift / MARQUEE_PX_PER_S) * 1000)) }
}

/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
function hoverTimeLabel(updatedAt: number, now: number, t: RowTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/**
 * Absolute creation time through the dictionary's date template (the message
 * clock pattern): `toLocaleString` would follow the browser language, not the
 * app locale, and produce mixed-language text after a switch.
 */
function createdLabel(createdAt: number, t: RowTranslate): string {
  const d = new Date(createdAt)
  const pad2 = (v: number): string => String(v).padStart(2, '0')
  const date = t('date.ymd', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() })
  return t('hover.created', { time: `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` })
}

/** Hover-card body: workspace title, display directory path, absolute creation time. */
function WorkspaceHoverContent({ label, cwd, createdAt, t }: {
  label: string
  cwd: string | undefined
  createdAt: number
  t: RowTranslate
}) {
  return (
    <div className={css.hoverContent}>
      <div className={css.hoverTitle}>{label}</div>
      <div className={css.hoverPath}>{cwd}</div>
      <div className={css.hoverTime}>{createdLabel(createdAt, t)}</div>
    </div>
  )
}

/**
 * Row drag wiring supplied by the tree owner. `drop` reports the half of the
 * row where the pointer released so the owner can resolve an insert anchor.
 */
export interface RowDragProps {
  /** Start dragging this row. */
  start: () => void
  /** A compatible row drag is in flight. */
  active: boolean
  /** Current marker on this row: insert line above, below, or none. */
  marker: 'before' | 'after' | null
  /** Report the hovered half while a compatible drag passes over this row. */
  hover: (half: 'before' | 'after') => void
  drop: (half: 'before' | 'after') => void
  end: () => void
}

/** Drag lifecycle owned by a workspace row; its enclosing group owns hit testing. */
interface WorkspaceRowDragProps {
  start: () => void
  end: () => void
}

/** Pointer-position half of a row (insert line above or below). */
function rowHalf(e: { clientY: number; currentTarget: HTMLElement }): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/**
 * Right-click context menu for a row with a Host Workspace directory: a single
 * "open location" entry that reveals the path in the OS file manager. Anchors
 * at the pointer through `getAnchorRect` (portal mode), so no trigger element
 * is rendered. Renders in the standard menu style shared with the row-action
 * ("...") menus.
 */
function RevealContextMenu({ position, onReveal, onClose, t }: {
  position: { x: number; y: number } | null
  onReveal: () => void
  onClose: () => void
  t: RowTranslate
}) {
  if (position === null) return null
  return (
    <Menu
      open
      anchor={null}
      items={[{ id: 'open-location', label: t('actions.openLocation'), icon: <IconFolderOpen16 /> }]}
      onSelect={() => { onClose(); onReveal() }}
      onClose={onClose}
      portal
      getAnchorRect={() => ({
        left: position.x, top: position.y, right: position.x, bottom: position.y,
        width: 0, height: 0, x: position.x, y: position.y, toJSON: () => ({}),
      })}
    />
  )
}

/**
 * Project (workspace) header row: folder + title;
 * hover reveals the chevron and create button, and dwelling on a real
 * Workspace shows its hover card (the ungrouped bucket has none).
 * `containsCurrent` arrives on the node (derivation fact, no renderer scan).
 * @param props.group - derived group node.
 * @param props.onToggle - expand/collapse the group.
 * @param props.onCreate - start a frontend Session inside this Workspace.
 * @param props.drag - optional workspace-row drag wiring.
 * @param props.home - host account home for POSIX hover-path abbreviation.
 * @param props.t - the browser root's locale seat.
 * @returns the row element.
 */
export function ProjectRowItem({ group, onToggle, onCreate, actions, drag, home, onOpenLocation, t }: {
  group: GroupNode
  onToggle: () => void
  onCreate: () => void
  /** Real-Workspace actions; absent for the ungrouped bucket (no menu shown). */
  actions?: { rename: () => void; delete: () => void } | undefined
  /** Present only for real Workspace rows in the grouped view. */
  drag?: WorkspaceRowDragProps | undefined
  /** Host account home; POSIX home-rooted hover paths display as `~`. */
  home?: string | undefined
  /** Reveal the Workspace directory in the OS file manager (right-click). */
  onOpenLocation?: ((cwd: string) => void) | undefined
  t: RowTranslate
}) {
  const row = group
  // The ungrouped bucket has no workspace title: its label is dictionary copy.
  const label = row.workspaceId === undefined ? t('group.ungrouped') : row.label
  const active = group.expanded && group.containsCurrent
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const revealCwd = onOpenLocation !== undefined && row.cwd !== undefined ? row.cwd : undefined
  const workspaceMenuItems = [
    { id: 'rename', label: t('rename'), icon: <IconEditOutline16 /> },
    { id: 'delete', label: t('delete.workspace'), icon: <IconTrashOutline16 />, danger: true },
  ]
  const ownRow = (
    <div
      className={clsx(css.projectRow, menuOpen && css.menuOpen)}
      role="treeitem"
      aria-expanded={row.expanded}
      onClick={onToggle}
      draggable={drag !== undefined}
      onDragStart={drag === undefined
        ? undefined
        : (e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', row.key)
          drag.start()
        }}
      onDragEnd={drag?.end}
      onContextMenu={revealCwd === undefined
        ? undefined
        : (e) => {
          e.preventDefault()
          e.stopPropagation()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
    >
      <span className={clsx(css.slot, css.folder, active && css.folderActive)}>
        {row.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
      </span>
      <span className={clsx(css.slot, css.chevron)}>
        <IconTriangleRightFill14 className={clsx(css.arrow, row.expanded && css.arrowOpen)} />
      </span>
      <span className={css.projectText}>
        <span className={css.title}>{label}</span>
      </span>
      <span className={css.rowActions}>
        {actions !== undefined && (
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={workspaceMenuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              // Unknown ids leave before the dispatch: a future menu row must
              // not inherit the destructive branch as an else fallback.
              /* v8 ignore next -- workspaceMenuItems carries exactly these two rows today. */
              if (id !== 'rename' && id !== 'delete') return
              if (id === 'rename') actions.rename()
              else actions.delete()
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('actions.workspace.aria', { name: label })}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              >
                <IconEllipsisOutline16 />
              </button>
            )}
          />
        )}
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('actions.newSession.aria', { name: label })}
          onClick={(e) => { e.stopPropagation(); onCreate() }}
        >
          <IconPlusOutline16 />
        </button>
      </span>
    </div>
  )
  // The ungrouped bucket has no backing Workspace: no card to show.
  const rowContent = row.createdAt === undefined
    ? ownRow
    : (
      <HoverCard
        anchor={ownRow}
        content={<WorkspaceHoverContent
          label={row.label}
          cwd={row.cwd === undefined ? undefined : abbreviateHomePath(row.cwd, home)}
          createdAt={row.createdAt}
          t={t}
        />}
        disabled={menuOpen}
        copyText={row.cwd}
        copyLabel={t('copy')}
        copiedLabel={t('hover.copied')}
      />
    )
  return (
    <>
      {rowContent}
      {revealCwd !== undefined && onOpenLocation !== undefined && (
        <RevealContextMenu
          position={contextMenu}
          onReveal={() => { onOpenLocation(revealCwd) }}
          onClose={() => { setContextMenu(null) }}
          t={t}
        />
      )}
    </>
  )
}

/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
function assertNever(value: never): never {
  throw new Error(`unknown pending interaction: ${String(value)}`)
}

interface SessionStatus {
  state: StateDotState
  label: string
}

/**
 * Session status presentation; pending interaction is primary and live activity
 * outranks completion reminders.
 */
function sessionStatuses(
  node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>,
  t: RowTranslate,
): readonly [SessionStatus, ...SessionStatus[]] {
  const subagents: SessionStatus | undefined = node.runningSubagentCount === 0
    ? undefined
    : {
      state: 'ongoing',
      label: t(
        node.runningSubagentCount === 1
          ? 'status.subagentsRunning.one'
          : 'status.subagentsRunning.other',
        { n: node.runningSubagentCount },
      ),
    }
  let pending: SessionStatus | undefined
  switch (node.pendingInteraction) {
    case 'approval':
      pending = { state: 'warning', label: t('status.waitingApproval') }
      break
    case 'plan-review':
      pending = { state: 'warning', label: t('status.planReview') }
      break
    case 'question':
      pending = { state: 'warning', label: t('status.waitingAnswer') }
      break
    case undefined: break
    /* v8 ignore next -- closed PendingInteractionStatus union */
    default: return assertNever(node.pendingInteraction)
  }
  if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents]
  if (node.running) {
    const primary: SessionStatus = { state: 'ongoing', label: t('status.running') }
    return subagents === undefined ? [primary] : [primary, subagents]
  }
  if (subagents !== undefined) return [subagents]
  if (node.completed) return [{ state: 'done', label: t('status.completed') }]
  return [{ state: 'done', label: t('status.idle') }]
}

/** Primary status dot plus every status's screen-reader label, shared by the search and session rows. */
function SessionStatusDots({ statuses }: { statuses: readonly [SessionStatus, ...SessionStatus[]] }) {
  return (
    <>
      <StateDot state={statuses[0].state} />
      {statuses.map(status => (
        <span className={css.visuallyHidden} key={status.label}>{status.label}</span>
      ))}
    </>
  )
}

/** Hover-card body: multi-line title, monitor+time header, folder+workspace footer. */
export function SessionHoverContent({ node, now, workspace, t }: {
  node: SessionNode
  now: number
  workspace: string | undefined
  t: RowTranslate
}) {
  return (
    <div className={css.hoverContent}>
      <div className={css.hoverHeader}>
        <div className={css.hoverTitle}>{displayTitle(node, t)}</div>
        {!node.blank && (
          <div className={css.hoverTimeBadge}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2.5" width="14" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>{hoverTimeLabel(node.updatedAt, now, t)}</span>
          </div>
        )}
      </div>
      {workspace !== undefined && (
        <div className={css.hoverProject}>
          <IconFolderOpenOutline16 size={12} />
          <span>{workspace}</span>
        </div>
      )}
    </div>
  )
}

/** Hover dwell before the shared list card first shows. */
const LIST_HOVER_OPEN_MS = 120
/** Grace before the shared list card closes once the pointer leaves rows and card. */
const LIST_HOVER_CLOSE_MS = 200

/** The row the shared session hover card currently presents. */
export interface SessionListHoverTarget {
  id: SessionId
  /** Live row element; the card re-reads its rect on scroll while open. */
  el: HTMLElement
}

/** Shared hover-card control surface handed to every session row in a list. */
export interface SessionListHoverApi {
  target: SessionListHoverTarget | null
  /** Pointer entered a session row. */
  enter: (id: SessionId, el: HTMLElement) => void
  /** Pointer left a session row. */
  leave: () => void
  /** Pointer entered the card itself: cancel a pending close. */
  cardEnter: () => void
  /** Pointer left the card: arm the grace close. */
  cardLeave: () => void
  /** Close immediately (menu opened, drag started, press inside the list). */
  hide: () => void
}

/**
 * One hover card for the whole session list. Per-row cards each run their own
 * open/close timing, so the pointer transits a close-and-reopen flicker moving
 * between adjacent rows; the shared card retargets in place instead — the
 * dwell only applies to the first open, row-to-row moves are immediate, and a
 * single grace covers the row-to-card gap. `disabled` (a drag in flight)
 * closes whatever is open.
 */
export function useSessionListHover(disabled: boolean): SessionListHoverApi {
  const [target, setTarget] = useState<SessionListHoverTarget | null>(null)
  const targetRef = useRef(target)
  targetRef.current = target
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearOpen = useCallback(() => {
    if (openTimer.current === null) return
    clearTimeout(openTimer.current)
    openTimer.current = null
  }, [])
  const clearClose = useCallback(() => {
    if (closeTimer.current === null) return
    clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  const hide = useCallback(() => {
    clearOpen()
    clearClose()
    setTarget(null)
  }, [clearOpen, clearClose])

  const enter = useCallback((id: SessionId, el: HTMLElement) => {
    clearClose()
    if (targetRef.current !== null) {
      // The card is already up: slide straight onto the new row.
      clearOpen()
      setTarget({ id, el })
      return
    }
    clearOpen()
    openTimer.current = setTimeout(() => {
      openTimer.current = null
      setTarget({ id, el })
    }, LIST_HOVER_OPEN_MS)
  }, [clearOpen, clearClose])

  const armClose = useCallback(() => {
    clearClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setTarget(null)
    }, LIST_HOVER_CLOSE_MS)
  }, [clearClose])

  const leave = useCallback(() => {
    clearOpen()
    if (targetRef.current !== null) armClose()
  }, [clearOpen, armClose])

  useEffect(() => {
    if (disabled) hide()
  }, [disabled, hide])
  useEffect(() => () => { clearOpen(); clearClose() }, [clearOpen, clearClose])

  return { target, enter, leave, cardEnter: clearClose, cardLeave: armClose, hide }
}

/**
 * The shared card: one fixed-position portal that re-reads the hovered row's
 * rect (surviving list scrolls) and slides between rows with a compositor
 * transform transition. Prefers the row's right side and flips to its left
 * when the viewport has no room.
 * @param props.target - hovered row; null renders nothing.
 * @param props.onCardEnter - pointer reached the card (cancel the grace close).
 * @param props.onCardLeave - pointer left the card (arm the grace close).
 * @param props.children - the hovered session's card body.
 * @returns the portaled card element.
 */
export function SessionListHoverCard({ target, onCardEnter, onCardLeave, children }: {
  target: SessionListHoverTarget | null
  onCardEnter: () => void
  onCardLeave: () => void
  children: ReactNode
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (target === null) { setPos(null); return }
    const place = () => {
      const r = target.el.getBoundingClientRect()
      const w = cardRef.current?.offsetWidth ?? 260
      const h = cardRef.current?.offsetHeight ?? 0
      let x = r.right + 8
      if (x + w > window.innerWidth - 8) x = Math.max(8, r.left - w - 8)
      let y = r.top
      if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8)
      setPos({ x, y })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [target])

  // First placement measured before the swapped-in content settled; re-clamp
  // once the card's real height is readable. Converges like HoverCard's fix-up.
  useLayoutEffect(() => {
    if (target === null || pos === null) return
    const h = cardRef.current?.offsetHeight ?? 0
    if (pos.y + h > window.innerHeight - 8) {
      setPos({ x: pos.x, y: Math.max(8, window.innerHeight - h - 8) })
    }
  }, [target, pos])

  if (target === null || pos === null) return null
  return createPortal(
    <div
      ref={cardRef}
      className={css.listHoverCard}
      style={{ '--list-hover-x': `${pos.x}px`, '--list-hover-y': `${pos.y}px` } as CSSProperties}
      onPointerEnter={onCardEnter}
      onPointerLeave={onCardLeave}
    >
      {children}
    </div>,
    document.body,
  )
}

/**
 * One flat search result: title, Workspace context, and optional content
 * excerpt. Search navigation opens the session only; it does not address an
 * event inside the conversation.
 * @param props.result - merged local/content search row.
 * @param props.currentId - selected session id.
 * @param props.onOpen - open the selected session.
 * @param props.t - Workspace-browser translation seat.
 * @returns the result button.
 */
export function SearchResultItem({ result, currentId, onOpen, t }: {
  result: SearchResultNode
  currentId: string | undefined
  onOpen: (id: SearchResultNode['id']) => void
  t: RowTranslate
}) {
  const selected = result.id === currentId
  const statuses = sessionStatuses(result, t)
  const primaryStatus = statuses[0]
  return (
    <button
      type="button"
      className={clsx(css.searchResultRow, selected && css.selected)}
      role="treeitem"
      aria-selected={selected}
      onClick={() => { onOpen(result.id) }}
    >
      <span className={css.searchResultHeading}>
        <span className={css.slot}>
          {(primaryStatus.state !== 'done' || result.completed) && (
            <SessionStatusDots statuses={statuses} />
          )}
        </span>
        <span className={css.searchResultTitle}>{result.title}</span>
      </span>
      <span className={css.searchResultMeta}>
        <span className={css.searchResultWorkspace}>{result.workspace}</span>
        {result.snippet !== undefined && (
          <span className={css.searchResultSnippet}>{result.snippet}</span>
        )}
      </span>
    </button>
  )
}

/**
 * One session card: bold title + relative time header. Status dots (pending
 * user interaction outranks own or descendant activity) lead the header; the
 * row actions menu surfaces on hover. Double-clicking the title renames
 * inline when the owner supplies a commit verb; the shared list hover card
 * anchors to the row through the `hover` share.
 * @param props.node - derived session node.
 * @param props.currentId - selected session id (row highlight).
 * @param props.now - epoch ms for relative-time formatting.
 * @param props.onOpen - open a session by id.
 * @param props.onRename - open the session rename dialog (id + current title).
 * @param props.onRenameCommit - inline double-click rename commit; absent keeps the dialog-only path.
 * @param props.onFork - fork a session at its last completed turn.
 * @param props.onArchive - archive a session by id.
 * @param props.drag - optional draggable-row wiring.
 * @param props.hover - shared list hover-card wiring.
 * @param props.flat - omit the empty status slot in the hierarchy-free flat list.
 * @param props.onOpenLocation - reveal the session's Host Workspace directory (right-click).
 * @param props.pinned - render the pinned-section treatment (always-visible pin + menu).
 * @param props.onTogglePin - toggle the session's pin membership.
 * @param props.t - the browser root's locale seat.
 * @returns the session card.
 */
export function SessionNodeItem({
  node, currentId, now, onOpen, onRename, onRenameCommit, onFork, onArchive,
  drag, hover, flat = false, onOpenLocation, pinned = false, onTogglePin, t,
}: {
  node: SessionNode
  currentId: string | undefined
  now: number
  onOpen: (id: SessionNode['id']) => void
  /** Open the browser-owned session rename dialog (row menu action). */
  onRename: (id: SessionNode['id'], currentTitle: string) => void
  /** Commit an inline (title double-click) rename. */
  onRenameCommit?: ((id: SessionNode['id'], title: string) => void) | undefined
  /** Fork a session at its last completed turn (row menu action). */
  onFork: (id: SessionNode['id']) => void
  /** Archive this session (row menu action; commits without a dialog). */
  onArchive: (id: SessionNode['id']) => void
  /** Present only on draggable rows (workspace-group sessions outside search). */
  drag?: RowDragProps | undefined
  /** Shared session-list hover-card wiring. */
  hover?: SessionListHoverApi | undefined
  /** The row is rendered without a parent Workspace header. */
  flat?: boolean | undefined
  /** Reveal the session's Host Workspace directory in the OS file manager (right-click). */
  onOpenLocation?: ((cwd: string) => void) | undefined
  /** The row renders in the pinned section (layered card; pin + menu always visible). */
  pinned?: boolean | undefined
  /** Toggle the session's pin membership (menu action and pinned-row badge). */
  onTogglePin?: ((id: SessionNode['id']) => void) | undefined
  t: RowTranslate
}) {
  const row = node
  const title = displayTitle(node, t)
  const selected = node.id === currentId
  const statuses = sessionStatuses(node, t)
  const primaryStatus = statuses[0]
  const showStatus = primaryStatus.state !== 'done' || row.completed
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const revealCwd = onOpenLocation !== undefined && node.cwd !== undefined ? node.cwd : undefined

  // Inline rename: double-click the title; Enter/blur commits through the
  // owner's rename verb, Escape cancels. Blank rows have no title to rename.
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const canInlineRename = onRenameCommit !== undefined && !row.blank
  const startRename = (): void => {
    if (!canInlineRename) return
    setDraft(row.title)
    setRenaming(true)
  }
  const commitRename = (): void => {
    setRenaming(false)
    const next = draft.trim()
    if (next !== '' && next !== row.title) onRenameCommit?.(node.id, next)
  }
  useEffect(() => {
    if (!renaming) return
    renameRef.current?.focus()
    renameRef.current?.select()
  }, [renaming])

  // A menu up or a drag in flight hides the shared hover card immediately.
  useEffect(() => {
    if (menuOpen || drag?.active === true) hover?.hide()
  }, [menuOpen, drag?.active, hover])

  // Hover marquee: a title wider than its cell scrolls its exact overflow
  // distance (never past its own box) while the pointer rests on the row.
  // Measured on entry because the cell width depends on the trailing cells.
  const titleRef = useRef<HTMLSpanElement>(null)
  const [marquee, setMarquee] = useState<{ shift: number; durationMs: number } | undefined>(undefined)
  const measureMarquee = (): void => {
    const el = titleRef.current
    if (el === null) return
    setMarquee(titleMarquee(el.scrollWidth, el.clientWidth))
  }

  // Archive hides the row through the registry-global archive set and never
  // touches the session log, so it is not styled as destructive and needs no
  // confirmation dialog.
  const sessionMenuItems = [
    ...(onTogglePin !== undefined && !row.blank
      ? [{ id: pinned ? 'unpin' : 'pin', label: t(pinned ? 'menu.unpin' : 'menu.pin'), icon: <IconPinOutline16 /> }]
      : []),
    { id: 'rename', label: t('rename'), icon: <IconEditOutline16 /> },
    { id: 'fork', label: t('menu.fork'), icon: <IconBranchOutline16 /> },
    // 20-native glyph in the menu's 16px icon slot (Menu.module.css .itemIcon).
    { id: 'archive', label: t('menu.archiveSession'), icon: <IconArchiveOutline20 size={16} /> },
  ]
  // layout="position": pin/unpin and section moves FLIP the row into place
  // (the make-way feedback) without animating the row's own size changes.
  // The native HTML5 drag handlers share prop names with motion's own drag
  // gesture, whose signatures differ; this row uses the native events, so
  // the bundle is typed natively and asserted once at the spread. The
  // assertion is double because the two event families are genuinely
  // unrelated types — that mismatch is exactly why the bundle exists.
  const dragHandlers = drag === undefined
    ? { draggable: false }
    : {
      draggable: true,
      onDragStart: (e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', node.id)
        drag.start()
      },
      onDragEnd: drag.end,
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!drag.active) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        drag.hover(rowHalf(e))
      },
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        if (!drag.active) return
        e.preventDefault()
        drag.drop(rowHalf(e))
      },
    } as unknown as HTMLMotionProps<'div'>
  return (
    <>
      <motion.div
        layout="position"
        className={clsx(
          css.sessionRow, selected && css.selected, menuOpen && css.menuOpen,
          !flat && css.nestedSessionRow, pinned && css.pinned,
          drag?.marker === 'before' && css.dropBefore, drag?.marker === 'after' && css.dropAfter,
        )}
        role="treeitem"
        aria-selected={selected}
        onClick={() => { onOpen(node.id) }}
        onPointerEnter={menuOpen
          ? undefined
          : (e) => {
            measureMarquee()
            hover?.enter(node.id, e.currentTarget)
          }}
        onPointerLeave={hover === undefined ? undefined : () => { hover.leave() }}
        {...dragHandlers}
        onContextMenu={revealCwd === undefined
          ? undefined
          : (e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenu({ x: e.clientX, y: e.clientY })
          }}
      >
        <div className={css.sessionCardHead}>
          {/* Pending interaction and own or descendant activity outrank the
              finished-but-unviewed reminder, which returns after activity stops
              and is cleared by opening the session. */}
          {(!flat || showStatus) && (
            <span className={css.slot}>
              {showStatus && <SessionStatusDots statuses={statuses} />}
            </span>
          )}
          {renaming
            ? (
              <input
                ref={renameRef}
                className={css.renameInput}
                value={draft}
                maxLength={120}
                aria-label={t('session.rename.aria')}
                onClick={(e) => { e.stopPropagation() }}
                onChange={(e) => { setDraft(e.target.value) }}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
              />
            )
            : (
              <span
                ref={titleRef}
                className={css.title}
                onDoubleClick={(e) => {
                  if (!canInlineRename) return
                  e.stopPropagation()
                  startRename()
                }}
              >
                <span
                  className={css.titleText}
                  style={marquee === undefined
                    ? undefined
                    : ({ '--marquee-shift': `${-marquee.shift}px`, '--marquee-duration': `${marquee.durationMs}ms` } as CSSProperties)}
                >
                  {title}
                </span>
              </span>
            )}
          {/* A blank New Session row is a provisional placeholder: nothing has
              happened in it yet, so a "now" timestamp and the row verbs
              (rename/fork/archive) would all act on content that does not
              exist — both trailing cells stay off until the first prompt. */}
          {!row.blank && pinned && onTogglePin !== undefined && (
            <button
              type="button"
              className={css.pinBadge}
              aria-label={t('actions.unpin.aria', { name: title })}
              onClick={(e) => { e.stopPropagation(); onTogglePin(node.id) }}
            >
              <IconPinOutline16 size={14} />
            </button>
          )}
          {!row.blank && <span className={css.time}>{timeLabel(row.updatedAt, now, t)}</span>}
          {!row.blank && (
            <span className={css.rowActions}>
              <Menu
                open={menuOpen}
                onClose={() => { setMenuOpen(false) }}
                items={sessionMenuItems}
                onSelect={(id) => {
                  setMenuOpen(false)
                  if (id === 'rename') onRename(node.id, row.title)
                  if (id === 'fork') onFork(node.id)
                  if (id === 'archive') onArchive(node.id)
                  if (id === 'pin') onTogglePin?.(node.id)
                  if (id === 'unpin') onTogglePin?.(node.id)
                }}
                portal
                closeOnPointerLeave
                anchor={(
                  <button
                    type="button"
                    className={css.iconButton}
                    aria-label={t('actions.session.aria', { name: title })}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                  >
                    <IconEllipsisOutline16 />
                  </button>
                )}
              />
            </span>
          )}
        </div>
      </motion.div>
      {revealCwd !== undefined && onOpenLocation !== undefined && (
        <RevealContextMenu
          position={contextMenu}
          onReveal={() => { onOpenLocation(revealCwd) }}
          onClose={() => { setContextMenu(null) }}
          t={t}
        />
      )}
    </>
  )
}
