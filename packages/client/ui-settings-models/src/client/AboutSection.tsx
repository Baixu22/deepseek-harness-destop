/**
 * The desktop edition's About page: brand head, version lineage, project
 * home, and the Electron updater surface, composed in the settings panel's
 * row language (13/20 rows on border-l2 hairlines, capsule action) so it
 * reads as a first-class section. In a plain browser (no dshDesktop bridge)
 * the runtime and update rows simply stay hidden.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FishLogo, HoverCard } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconCloud } from './IconCloud.tsx'
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
  | 'aboutCopy' | 'aboutCopied' | 'aboutRepoHint'
  | 'aboutFoot'

/**
 * Live page screenshot of the repository home, delivered by the mshots
 * snapshot service as a pure enhancement: the card's text renders at once,
 * the shot fades in only if the service delivers, and a failure just drops
 * the image — the network can no longer take the URL reveal down with it
 * (the reason the previous microlink card was removed).
 * @param props.url - page URL to screenshot.
 * @returns the screenshot image, or nothing once the load has failed.
 */
function RepoShot({ url }: { url: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading')
  if (state === 'failed') return null
  return (
    <img
      className={state === 'ok'
        ? `${styles['aboutRepoCardShot']} ${styles['aboutRepoCardShotOk']}`
        : styles['aboutRepoCardShot']}
      src={`https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=480`}
      alt=""
      onLoad={() => { setState('ok') }}
      onError={() => { setState('failed') }}
    />
  )
}

/** Props of {@link AboutSection}. */
export interface AboutSectionProps {
  /** Bound translate of the models namespace (shares its copy seats). */
  t: (key: AboutKey) => string
}

/** simple-icons slugs orbiting the About sphere (magicui demo roster). */
const ABOUT_ICON_SLUGS = [
  'typescript', 'javascript', 'dart', 'java', 'react', 'flutter', 'android', 'html5',
  'css3', 'nodedotjs', 'express', 'nextdotjs', 'prisma', 'amazonaws', 'postgresql',
  'firebase', 'nginx', 'vercel', 'testinglibrary', 'jest', 'cypress', 'docker', 'git',
  'jira', 'github', 'gitlab', 'visualstudiocode', 'androidstudio', 'sonarqube', 'figma',
] as const

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
    return bridge.onUpdateState((next) => { setState(next) })
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
          {/* Address card with a live page preview: the text is local and
              immediate; the screenshot is a best-effort enhancement. */}
          <HoverCard
            side="bottom"
            openDelayMs={350}
            copyText={REPOSITORY}
            copyLabel={t('aboutCopy')}
            copiedLabel={t('aboutCopied')}
            anchor={(
              <a className={styles['aboutLink']} href={REPOSITORY} target="_blank" rel="noopener noreferrer">{REPOSITORY.replace('https://', '')}</a>
            )}
            content={(
              <div className={styles['aboutRepoCard']}>
                <RepoShot url={REPOSITORY} />
                <span className={styles['aboutRepoCardUrl']}>{REPOSITORY}</span>
                <span className={styles['aboutRepoCardHint']}>{t('aboutRepoHint')}</span>
              </div>
            )}
          />
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
      {/* Orbiting product glyph set (magicui IconCloud port). */}
      <IconCloud slugs={ABOUT_ICON_SLUGS} />
    </div>
  )
}
