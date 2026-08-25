/**
 * The desktop edition's About page: brand head, version lineage, project
 * home, and the Electron updater surface, composed in the settings panel's
 * row language (13/20 rows on border-l2 hairlines, capsule action) so it
 * reads as a first-class section. In a plain browser (no dshDesktop bridge)
 * the runtime and update rows simply stay hidden.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
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

/** Copy seat for the About section. */
export type AboutKey =
  | 'aboutNav' | 'aboutTagline' | 'aboutVersion' | 'aboutRuntime'
  | 'aboutRepo' | 'aboutCheckNow' | 'aboutChecking' | 'aboutUpToDate'
  | 'aboutDownloading' | 'aboutInstall' | 'aboutInstalling' | 'aboutError'
  | 'aboutFoot'

/** Props of {@link AboutSection}. */
export interface AboutSectionProps {
  /** Bound translate of the models namespace (shares its copy seats). */
  t: (key: AboutKey) => string
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
      case 'checking': return t('aboutChecking')
      case 'up-to-date': return t('aboutUpToDate')
      case 'downloading': return state.percent && state.percent > 0
        ? t('aboutDownloading') + ' ' + String(Math.round(state.percent)) + '%'
        : t('aboutDownloading')
      case 'downloaded': return t('aboutInstall')
      case 'installing': return t('aboutInstalling')
      case 'error': return t('aboutError')
      default: return t('aboutCheckNow')
    }
  }

  return (
    <div className={styles['about']}>
      <div className={styles['aboutHead']}>
        <FishLogo size={40} className={styles['aboutLogo']} />
        <div className={styles['aboutId']}>
          <span className={styles['aboutName']}>DeepSeek Harness Desktop</span>
          <span className={styles['aboutTag']}>{t('aboutTagline')}</span>
        </div>
        <span className={styles['aboutPill']}>v{state.currentVersion ?? '…'}</span>
      </div>
      <div className={styles['aboutRows']}>
        <div className={styles['aboutRow']}>
          <span className={styles['aboutKey']}>{t('aboutVersion')}</span>
          <span className={styles['aboutValue']}>DSH {state.currentVersion ?? '—'}</span>
        </div>
        {bridge?.versions !== undefined
          ? (
            <div className={styles['aboutRow']}>
              <span className={styles['aboutKey']}>{t('aboutRuntime')}</span>
              <span className={styles['aboutValue']}>Electron {bridge.versions.electron ?? '—'} · Chrome {bridge.versions.chrome ?? '—'}</span>
            </div>
          )
          : null}
        <div className={styles['aboutRow']}>
          <span className={styles['aboutKey']}>{t('aboutRepo')}</span>
          <a className={styles['aboutLink']} href={REPOSITORY} target="_blank" rel="noopener noreferrer">{REPOSITORY.replace('https://', '')}</a>
        </div>
        {checkForUpdates !== undefined
          ? (
            <div className={styles['aboutRow']}>
              <span className={styles['aboutKey']}>{t('aboutCheckNow')}</span>
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
      <p className={styles['aboutFoot']}>{t('aboutFoot')}</p>
    </div>
  )
}
