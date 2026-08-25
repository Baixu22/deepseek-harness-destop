/**
 * The desktop edition's About page: version lineage, project home, and the
 * Electron updater's check/install surface. Rendered as a settings section
 * so the desktop shell no longer needs its own top-bar buttons; in a plain
 * browser (no dshDesktop bridge) the update row simply stays hidden.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './ModelsSection.module.css'

/** The subset of the Electron preload bridge this page reads. */
interface DesktopBridge {
  versions?: { electron?: string; chrome?: string }
  getUpdateState?: () => Promise<AboutUpdateState>
  checkForUpdates?: () => Promise<unknown>
  installUpdate?: () => Promise<unknown>
  onUpdateState?: (listener: (state: AboutUpdateState) => void) => () => void
}

interface AboutUpdateState {
  status: string
  currentVersion?: string
  version?: string
  percent?: number
  message?: string
}

/** Props of {@link AboutSection}. */
export interface AboutSectionProps {
  /** Bound translate of the models namespace (shares its copy seats). */
  t: (key: 'aboutNav' | 'aboutVersion' | 'aboutRuntime' | 'aboutRepo' | 'aboutRepoHint' | 'aboutCheck') => string
}

const REPOSITORY = 'https://github.com/Baixu22/deepseek-harness-destop'

/**
 * Render the About section.
 * @param props - bound copy.
 * @returns the section element tree.
 */
export function AboutSection({ t }: AboutSectionProps): ReactNode {
  const bridge = (globalThis as { dshDesktop?: DesktopBridge }).dshDesktop
  const checkForUpdates = bridge?.checkForUpdates
  const installUpdate = bridge?.installUpdate
  const [state, setState] = useState<AboutUpdateState>({ status: 'idle' })
  useEffect(() => {
    if (bridge === undefined || bridge.getUpdateState === undefined) return
    void bridge.getUpdateState().then(setState).catch(() => undefined)
    if (bridge.onUpdateState === undefined) return
    return bridge.onUpdateState(next => setState(next))
  }, [bridge])
  const statusLabel = (): string => {
    switch (state.status) {
      case 'checking': return '…'
      case 'up-to-date': return '✓'
      case 'downloading': return state.percent && state.percent > 0 ? String(state.percent) + '%' : '…'
      case 'downloaded': return '⬇'
      case 'installing': return '…'
      case 'error': return '!'
      default: return ''
    }
  }
  return (
    <div className={styles['about']}>
      <h2 className={styles['title']}>{t('aboutNav')}</h2>
      <div className={styles['field']}>
        <span className={styles['fieldLabel']}>{t('aboutVersion')}</span>
        <p className={styles['advancedHint']}>DSH {state.currentVersion ?? '—'}</p>
      </div>
      {bridge?.versions !== undefined
        ? (
          <div className={styles['field']}>
            <span className={styles['fieldLabel']}>{t('aboutRuntime')}</span>
            <p className={styles['advancedHint']}>Electron {bridge.versions.electron ?? '—'} · Chrome {bridge.versions.chrome ?? '—'}</p>
          </div>
        )
        : null}
      <div className={styles['field']}>
        <span className={styles['fieldLabel']}>{t('aboutRepo')}</span>
        <a className={styles['aboutLink']} href={REPOSITORY} target="_blank" rel="noopener noreferrer">{REPOSITORY.replace('https://', '')}</a>
        <p className={styles['advancedHint']}>{t('aboutRepoHint')}</p>
      </div>
      {checkForUpdates !== undefined
        ? (
          <div className={styles['field']}>
            <span className={styles['fieldLabel']}>{t('aboutCheck')}</span>
            <button
              type="button"
              className={styles['aboutCheckBtn']}
              disabled={state.status === 'checking' || state.status === 'installing'}
              onClick={() => {
                if (state.status === 'downloaded' && installUpdate !== undefined) void installUpdate()
                else void checkForUpdates()
              }}
            >
              {statusLabel()}
            </button>
          </div>
        )
        : null}
    </div>
  )
}
