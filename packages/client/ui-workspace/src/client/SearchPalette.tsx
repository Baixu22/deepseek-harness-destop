/**
 * The session search palette: the sidebar search buttons' shared-layout morph
 * target (the settings-shell pattern — trigger and panel carry one layoutId,
 * so the centered window grows out of the button). The panel is a command
 * palette: the chat query field, the merged local/content result list (or the
 * resting recent-chats body on an empty query), quick actions, and a keyboard
 * hint footer. Search state lives here so closing the panel retires the
 * in-flight request and the query with it.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import {
  IconFolderOpenOutline16, IconNewChatOutline16, IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceBrowserProps } from './contract/slots.ts'
import { deriveRecentSessions, deriveSearchResults } from './tree.ts'
import { SearchResultItem } from './rows/Rows.tsx'
import css from './SearchPalette.module.css'

/** Pause between the latest keystroke and a Host content-search request. */
const SEARCH_DEBOUNCE_MS = 250
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
const SEARCH_QUERY_MAX_CODE_UNITS = 500

/** Keep the controlled input inside the session.search wire contract. */
function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--
  return withoutNul.slice(0, end)
}

interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly { sessionId: SessionId; snippet: string }[]
  hasMore: boolean
}

/** One footer-selectable quick action. */
interface QuickAction {
  key: string
  icon: ReactNode
  label: string
  run: () => void
}

/** Palette props: the browser shares its stores, actions, and locale seat. */
export type SearchPaletteProps = {
  useSessions: WorkspaceBrowserProps['useSessions']
  openSession: WorkspaceBrowserProps['open']
  startSession: WorkspaceBrowserProps['startSession']
  searchSessions: WorkspaceBrowserProps['searchSessions']
  searchResultLimit: number
  workspaces: readonly WorkspaceView[]
  archivedSessionIds: readonly SessionId[]
  openLocation: WorkspaceBrowserProps['openLocation']
  home: string | undefined
  t: WorkspaceBrowserProps['t']
  onClose: () => void
}

/**
 * Render the centered search palette over a fading mask.
 * @param props - browser-shared stores, actions, and locale seat.
 * @returns the palette element tree.
 */
export function SearchPalette({
  useSessions, openSession, startSession, searchSessions, searchResultLimit,
  workspaces, archivedSessionIds, openLocation, home, t, onClose,
}: SearchPaletteProps) {
  const reduceMotion = useReducedMotion()
  const list = useSessions(s => s)
  const [query, setQuery] = useState('')
  const normalizedQuery = sanitizeSearchQuery(query).trim()
  const [remote, setRemote] = useState<RemoteSearchState>({
    query: '', status: 'idle', items: [], hasMore: false,
  })
  // Selection index across the merged rows-then-actions activation list.
  const [cursor, setCursor] = useState(0)

  // Same debounced Host content-search contract as the inline search this
  // panel replaces; unmounting the palette aborts the in-flight request.
  useEffect(() => {
    if (normalizedQuery === '') {
      setRemote({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemote({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemote({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemote({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Mounted only, so the listener lifetime is the panel's (settings pattern).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  const searching = normalizedQuery !== ''
  const currentRemote: RemoteSearchState = remote.query === normalizedQuery
    ? remote
    : { query: normalizedQuery, status: 'loading', items: [], hasMore: false }
  const { rows, hasMore } = useMemo(() => {
    if (!searching) {
      return {
        rows: deriveRecentSessions(list, workspaces, archivedSessionIds, searchResultLimit),
        hasMore: false,
      }
    }
    const set = deriveSearchResults(list, workspaces, normalizedQuery, archivedSessionIds, currentRemote, searchResultLimit)
    return { rows: set.items, hasMore: set.hasMore }
  }, [list, workspaces, normalizedQuery, archivedSessionIds, currentRemote, searchResultLimit, searching])

  const currentId = list.current
  const currentWorkspace = currentId !== undefined
    ? workspaces.find(workspace => workspace.sessionIds.includes(currentId))
    : undefined
  const quickActions = useMemo(() => {
    const actions: QuickAction[] = [
      {
        key: 'new-chat',
        icon: <IconNewChatOutline16 size={16} />,
        label: t('search.action.newChat'),
        run: () => { startSession(currentWorkspace?.workspaceId ?? workspaces[0]?.workspaceId) },
      },
    ]
    const folder = currentWorkspace?.path ?? home
    if (openLocation !== undefined && folder !== undefined) {
      actions.push({
        key: 'open-folder',
        icon: <IconFolderOpenOutline16 size={16} />,
        label: t('search.action.openFolder'),
        run: () => { openLocation(folder) },
      })
    }
    return actions
  }, [currentWorkspace, home, openLocation, startSession, t, workspaces])

  const total = rows.length + quickActions.length
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, total - 1)))
  }, [total])

  const openAndClose = (id: SessionId): void => {
    openSession(id)
    onClose()
  }

  const activate = (index: number): void => {
    const result = rows[index]
    if (result !== undefined) {
      openAndClose(result.id)
      return
    }
    quickActions[index - rows.length]?.run()
    onClose()
  }

  const pending = searching && currentRemote.status === 'loading'
  const failed = searching && currentRemote.status === 'error'

  return (
    <MotionConfig transition={{ type: 'spring', bounce: 0.08, duration: 0.5 }}>
      <div className={css.overlay} role="presentation">
        <motion.div
          className={css.mask}
          aria-hidden="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        />
        <motion.div
          layoutId="dsh-session-search"
          className={css.panel}
          role="dialog"
          aria-modal="true"
          aria-label={t('search.palette.aria')}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <motion.div
            className={css.fieldRow}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.25 } }}
          >
            <IconSearchOutline16 size={16} className={css.fieldIcon} />
            <input
              className={css.field}
              type="text"
              placeholder={t('search.placeholder')}
              maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
              value={query}
              autoFocus
              aria-label={t('search.palette.aria')}
              onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setCursor(c => Math.min(c + 1, total - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setCursor(c => Math.max(c - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  activate(cursor)
                }
              }}
            />
            <kbd className={css.kbd}>Esc</kbd>
          </motion.div>
          <motion.div
            className={css.body}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.25 } }}
          >
            <div className={css.sectionLabel}>{t('search.palette.chats')}</div>
            <div className={css.results} role="tree" aria-label={t('search.results.aria')}>
              {rows.map((result, index) => (
                <motion.div
                  key={result.id}
                  className={css.resultRow}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.22, delay: Math.min(index * 0.03, 0.24), ease: 'easeOut' }}
                  onMouseEnter={() => { setCursor(index) }}
                >
                  <SearchResultItem
                    result={result}
                    currentId={cursor === index ? result.id : undefined}
                    onOpen={openAndClose}
                    t={t}
                  />
                </motion.div>
              ))}
              {pending && (
                <div className={css.searchStatus} role="status">
                  {t('search.pending')}
                  {!reduceMotion && (
                    <span className={css.dots} aria-hidden="true">
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className={css.dot}
                          animate={{ opacity: [0.25, 1, 0.25] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              )}
              {failed && (
                <div className={css.searchWarning} role="status">{t('search.unavailable')}</div>
              )}
              {searching && !pending && rows.length === 0 && (
                <div className={css.emptyState}>{t('search.noMatches')}</div>
              )}
              {!searching && rows.length === 0 && (
                <div className={css.emptyState}>{t('empty.none')}</div>
              )}
              {searching && !pending && hasMore && (
                <div className={css.searchStatus}>{t('search.hasMore', { n: searchResultLimit })}</div>
              )}
            </div>
          </motion.div>
          {/* Quick actions sit outside the scrolling body, always visible
              above the hint footer like the reference palette. */}
          {quickActions.length > 0 && (
            <div className={css.actionsSection}>
              <div className={css.sectionLabel}>{t('search.palette.actions')}</div>
              <div className={css.actionList}>
                {quickActions.map((action, i) => {
                  const index = rows.length + i
                  return (
                    <button
                      key={action.key}
                      type="button"
                      className={clsx(css.action, cursor === index && css.actionActive)}
                      onMouseEnter={() => { setCursor(index) }}
                      onClick={() => { action.run(); onClose() }}
                    >
                      {action.icon}
                      <span className={css.actionLabel}>{action.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className={css.footer}>
            <span className={css.hint}><kbd className={css.kbd}>↑↓</kbd>{t('search.hint.navigate')}</span>
            <span className={css.hint}><kbd className={css.kbd}>↵</kbd>{t('search.hint.open')}</span>
            <span className={css.hint}><kbd className={css.kbd}>Esc</kbd>{t('search.hint.close')}</span>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  )
}
