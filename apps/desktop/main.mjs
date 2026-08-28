import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { get } from 'node:http'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, nativeTheme, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { BACKEND_RUNTIME_PATHS, backendLaunchArguments } from './backend-contract.mjs'
import { calibratePluginResolutionLinks } from './plugin-links.mjs'
import { DEFAULT_FOCUS_RECHECK_MIN_INTERVAL_MS, createUpdaterController } from './updater.mjs'
import { createSplashPage, diaRevealGradient } from './splash-page.mjs'
import { createWelcomePage } from './welcome-page.mjs'
import {
  applyWindowControl,
  createWindowControlsMarkup,
  WINDOW_CONTROLS_CSS,
} from './window-controls.mjs'

const { autoUpdater } = electronUpdater

const STARTUP_TIMEOUT_MS = 60_000
const HTTP_READY_TIMEOUT_MS = 30_000
const SHUTDOWN_TIMEOUT_MS = 8_000
const MAX_DIAGNOSTIC_LENGTH = 8_192
const DESKTOP_THEME_CSS = readFileSync(join(import.meta.dirname, 'codex-theme.css'), 'utf8')
const DESKTOP_ICON_DATA_URL = `data:image/png;base64,${readFileSync(join(import.meta.dirname, 'build', 'icon.png')).toString('base64')}`
// The black whale vanishes on a dark Windows taskbar and the white whale on
// a light one, so the taskbar/window icon follows the OS theme (see
// `applyThemeIcon`); the packaged exe icon stays the black whale.
const LIGHT_THEME_ICON = join(import.meta.dirname, 'build', 'icon-black.png')
const DARK_THEME_ICON = join(import.meta.dirname, 'build', 'icon-white.png')
// Missing theme icons load as empty images and the taskbar falls back to the
// exe icon, silently undoing the theme adaptation; a packaging omission must
// fail loud instead.
if (!existsSync(LIGHT_THEME_ICON) || !existsSync(DARK_THEME_ICON)) {
  throw new Error(`theme icons missing from the app bundle: ${LIGHT_THEME_ICON}, ${DARK_THEME_ICON}`)
}

/** Restate the taskbar/window icon for the current OS theme. */
function applyThemeIcon(window) {
  if (window.isDestroyed()) return
  window.setIcon(nativeImage.createFromPath(nativeTheme.shouldUseDarkColors ? DARK_THEME_ICON : LIGHT_THEME_ICON))
}

/**
 * Whether the harness home already holds a DeepSeek credential. A fresh
 * install has none and still needs onboarding, so it gets the full hero-style
 * welcome page; configured installs start on the compact wordmark splash.
 */
function hasDeepSeekCredential() {
  if (process.env.DEEPSEEK_API_KEY) return true
  try {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    return readFileSync(join(home, '.credentials.yaml'), 'utf8').includes('DEEPSEEK_API_KEY')
  } catch {
    /* no credentials document: the harness home has not been set up yet */
    return false
  }
}

let backendProcess
let backendUrl
let allowQuit = false
let mainWindow
let shutdownPromise
let packagedBackendRoot
let updaterController

/** Runtime files that must exist in an installed backend root. */
function backendRequiredPaths(root) {
  return BACKEND_RUNTIME_PATHS.map(segments => join(root, ...segments))
}

function updateStartupStatus(progress = 18) {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  const script = `{
    const wordmark = document.getElementById('startup-wordmark');
    if (wordmark) wordmark.style.backgroundImage = ${JSON.stringify(diaRevealGradient(progress))};
  }`
  void mainWindow.webContents.executeJavaScript(script).catch(() => undefined)
}

/**
 * Resolve the backend runtime root and return it as the
 * `node_modules/@deepseek-ai` anchor scope for profile-plugin resolution.
 * Installed builds ship the backend uncompressed under resources (the
 * installer unpacks it), so startup never pays extraction latency;
 * development runs the workspace CLI's own dependency closure.
 */
async function prepareBackendRoot() {
  const backendRoot = app.isPackaged
    ? join(process.resourcesPath, 'backend')
    : join(app.getAppPath(), '..', 'cli')
  const missing = backendRequiredPaths(backendRoot).filter(path => !existsSync(path))
  if (missing.length > 0) {
    throw new Error(`DeepSeek Harness backend runtime is incomplete:\n${missing.join('\n')}`)
  }
  // Profile plugins bare-import workspace packages from their own physical
  // directory chain; restate the anchor on every startup. Idempotent, and it
  // establishes the anchor on first launch after a fresh install.
  await calibratePluginResolutionLinks({
    dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    backendRoot,
  })
  packagedBackendRoot = backendRoot
  return backendRoot
}

function backendEntryPath() {
  if (app.isPackaged) {
    return join(
      packagedBackendRoot,
      'node_modules',
      '@deepseek-ai',
      'dsh',
      'lib',
      'bin.js',
    )
  }
  return join(app.getAppPath(), '..', 'cli', 'lib', 'bin.js')
}

function appendDiagnostic(current, chunk) {
  return `${current}${chunk.toString()}`.slice(-MAX_DIAGNOSTIC_LENGTH)
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function waitForBackendHttp(url) {
  const deadline = Date.now() + HTTP_READY_TIMEOUT_MS
  let lastError
  while (Date.now() < deadline) {
    try {
      const status = await new Promise((resolve, reject) => {
        const request = get(url, { agent: false }, (response) => {
          response.resume()
          response.once('end', () => resolve(response.statusCode ?? 0))
        })
        request.setTimeout(3_000, () => request.destroy(new Error('HTTP readiness request timed out')))
        request.once('error', reject)
      })
      if (status >= 200 && status < 300) return
      lastError = new Error(`HTTP ${String(status)}`)
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }
  throw new Error(
    `DeepSeek Harness backend did not accept HTTP requests within ${HTTP_READY_TIMEOUT_MS / 1000} seconds.`,
    { cause: lastError },
  )
}

function startBackend() {
  // Both modes run the built CLI: the tsx source launch spent ~20s of
  // transform work on every startup while the built bin boots in ~2s, and
  // `prepareBackendRoot` has already anchored profile-plugin resolution at
  // the CLI's own node_modules, so plugin externals resolve against the
  // workspace closure exactly as they do against the staged backend.
  const entry = backendEntryPath()
  if (!existsSync(entry)) {
    throw new Error(`DeepSeek Harness backend is missing: ${entry}`)
  }

  const child = spawn(
    process.execPath,
    backendLaunchArguments(entry),
    {
      cwd: app.isPackaged ? app.getPath('documents') : join(app.getAppPath(), '..', '..'),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  backendProcess = child

  return new Promise((resolve, reject) => {
    let settled = false
    let output = ''
    const timeout = setTimeout(() => {
      finish(new Error(`DeepSeek Harness did not become ready within ${STARTUP_TIMEOUT_MS / 1000} seconds.\n${output}`))
    }, STARTUP_TIMEOUT_MS)

    const finish = (error, url) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('error', onError)
      child.off('exit', onExit)
      if (error) reject(error)
      else resolve(url)
    }

    const inspect = (chunk) => {
      output = appendDiagnostic(output, chunk)
      process.stdout.write(chunk)
      const match = output.match(/dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/)
      if (match?.[1]) finish(undefined, match[1])
    }
    const onError = (error) => finish(error)
    const onExit = (code, signal) => {
      finish(new Error(`DeepSeek Harness stopped during startup (code ${String(code)}, signal ${String(signal)}).\n${output}`))
    }

    child.stdout.on('data', inspect)
    child.stderr.on('data', (chunk) => {
      output = appendDiagnostic(output, chunk)
      process.stderr.write(chunk)
    })
    child.on('error', onError)
    child.on('exit', onExit)
  })
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  if (!await waitForExit(child, SHUTDOWN_TIMEOUT_MS)) await forceStopProcessTree(child)
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    const onExit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    child.once('exit', onExit)
  })
}

async function forceStopProcessTree(child) {
  if (process.platform !== 'win32') {
    child.kill('SIGKILL')
    await waitForExit(child, SHUTDOWN_TIMEOUT_MS)
    return
  }

  const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  await new Promise((resolve) => killer.once('exit', resolve))
  await waitForExit(child, SHUTDOWN_TIMEOUT_MS)
}

function stopBackend() {
  if (shutdownPromise) return shutdownPromise
  shutdownPromise = (async () => {
    const child = backendProcess
    backendProcess = undefined
    await stopChildProcess(child)
  })()
  return shutdownPromise
}

async function createWindow({ cachedBackend = false } = {}) {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101317' : '#ffffff',
    title: 'DSH · DeepSeek Harness 桌面版',
    icon: join(app.getAppPath(), 'build', 'icon.ico'),
    frame: process.platform !== 'win32',
    webPreferences: {
      preload: join(app.getAppPath(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) void shell.openExternal(target)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (backendUrl !== undefined && new URL(target).origin === new URL(backendUrl).origin) return
    event.preventDefault()
    if (target.startsWith('http://') || target.startsWith('https://')) void shell.openExternal(target)
  })
  window.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle('DSH · DeepSeek Harness 桌面版')
  })
  // Theme, injected CSS, and window controls live on the document, not the
  // window: a reload wipes them, so re-apply on every dom-ready instead of
  // only after the first backend load.
  window.webContents.on('dom-ready', () => {
    // The startup pages carry their own complete styles; the injected desktop
    // theme targets the backend app document and would repaint them.
    if (window.webContents.getURL().startsWith('data:')) return
    void applyDesktopTheme(window)
  })
  const publishWindowState = () => {
    if (!window.isDestroyed()) {
      window.webContents.send('dsh-desktop:window-state', { maximized: window.isMaximized() })
    }
  }
  window.on('maximize', publishWindowState)
  window.on('unmaximize', publishWindowState)
  applyThemeIcon(window)
  const loadingPage = hasDeepSeekCredential()
    ? createSplashPage({
        cachedBackend,
        frameless: process.platform === 'win32',
      })
    : createWelcomePage({
        cachedBackend,
        frameless: process.platform === 'win32',
        iconDataUrl: DESKTOP_ICON_DATA_URL,
        version: app.getVersion(),
      })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingPage)}`)
  await installWindowControls(window)
  return window
}

ipcMain.handle('dsh-desktop:pick-directory', async (event) => {
  if (
    mainWindow === undefined
    || mainWindow.isDestroyed()
    || event.sender.id !== mainWindow.webContents.id
  ) throw new Error('directory picker request came from an unknown window')

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择工作目录',
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

function assertMainWindowSender(event) {
  if (
    mainWindow === undefined
    || mainWindow.isDestroyed()
    || event.sender.id !== mainWindow.webContents.id
  ) throw new Error('desktop request came from an unknown window')
}

ipcMain.handle('dsh-desktop:get-update-state', (event) => {
  assertMainWindowSender(event)
  return updaterController?.getState() ?? { status: 'idle', currentVersion: app.getVersion() }
})

ipcMain.handle('dsh-desktop:check-for-updates', async (event) => {
  assertMainWindowSender(event)
  return await updaterController?.check({ manual: true })
})

ipcMain.handle('dsh-desktop:install-update', async (event) => {
  assertMainWindowSender(event)
  await updaterController?.install()
})

ipcMain.handle('dsh-desktop:window-control', (event, action) => {
  // Act on the window that actually sent the request: the injected controls
  // race window teardown (close click vs in-flight get-state), and a stale
  // sender must degrade to a neutral state, not an unhandled handler error.
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (senderWindow === null || senderWindow.isDestroyed()) return { maximized: false }
  return applyWindowControl(senderWindow, action)
})

ipcMain.handle('dsh-desktop:open-path', async (event, path) => {
  assertMainWindowSender(event)
  if (typeof path !== 'string' || path === '') {
    throw new Error('open-path requires a non-empty path string')
  }
  return await shell.openPath(path)
})

// Left-side quick actions on the backend app page: the community repository
// link and the manual update control. Inserted alongside the window controls
// so a reload or navigation re-restores them.
async function installTopActions(window) {
  await window.webContents.executeJavaScript(`{
    const bridge = globalThis.dshDesktop;
    if (!bridge) return;
    let actions = document.getElementById('dsh-desktop-top-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'dsh-desktop-top-actions';
      actions.setAttribute('aria-label', 'DSH 快捷操作');
      document.body.append(actions);
    }
    if (!document.getElementById('dsh-desktop-repository')) {
      const repository = document.createElement('a');
      repository.id = 'dsh-desktop-repository';
      repository.href = 'https://github.com/luo-ross/dsh-desktop';
      repository.target = '_blank';
      repository.rel = 'noopener noreferrer';
      repository.textContent = 'GitHub 仓库';
      repository.setAttribute('aria-label', '在浏览器中打开 DSH GitHub 仓库');
      actions.append(repository);
    }
    if (bridge.checkForUpdates && !document.getElementById('dsh-desktop-update')) {
      const button = document.createElement('button');
      button.id = 'dsh-desktop-update';
      button.type = 'button';
      button.setAttribute('aria-label', '检查 DSH 更新');
      actions.append(button);
      const labels = {
        idle: '检查更新',
        checking: '正在检查…',
        'up-to-date': '已是最新版',
        downloading: state => state.percent > 0 ? '下载更新 ' + state.percent + '%' : '发现 v' + (state.version ?? ''),
        downloaded: '立即更新 v' + (state.version ?? ''),
        installing: '正在安装…',
        error: '更新检查失败',
      };
      const renderUpdateState = (state) => {
        const button = document.getElementById('dsh-desktop-update');
        if (!button) return;
        const label = labels[state.status];
        button.textContent = typeof label === 'function' ? label(state) : label ?? '检查更新';
        button.dataset.status = state.status;
        button.disabled = state.status === 'checking' || state.status === 'installing';
        button.title = state.message ?? ('DSH ' + state.currentVersion);
      };
      // Delegate from the document like the window controls: the app page
      // re-renders the body around the injected actions, so node-level
      // listeners would go silent after the first re-render.
      if (!globalThis.__dshTopActionsBound) {
        globalThis.__dshTopActionsBound = true;
        document.addEventListener('click', (event) => {
          const button = event.target.closest?.('#dsh-desktop-update');
          if (!button || button.disabled) return;
          if (button.dataset.status === 'downloaded') void bridge.installUpdate().catch(() => {});
          else void bridge.checkForUpdates().catch(() => {});
        });
      }
      void bridge.getUpdateState().then(renderUpdateState);
      const unsubscribe = bridge.onUpdateState?.(renderUpdateState);
      if (unsubscribe) window.addEventListener('beforeunload', unsubscribe, { once: true });
    }
  }`)
}

async function installWindowControls(window) {
  if (process.platform !== 'win32') return
  await window.webContents.executeJavaScript(`{
    const bridge = globalThis.dshDesktop;
    if (bridge?.windowControl) {
      if (!document.getElementById('dsh-window-controls')) {
        document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(createWindowControlsMarkup())});
      }
      const renderWindowState = (state) => {
        const maximizeButton = document.querySelector('#dsh-window-controls [data-window-action="toggle-maximize"]');
        if (!maximizeButton) return;
        const maximized = Boolean(state?.maximized);
        maximizeButton.setAttribute('aria-label', maximized ? '还原' : '最大化');
        maximizeButton.querySelector('span').textContent = maximized ? '\\uE923' : '\\uE922';
      };
      // Delegate from the document: the app page re-renders the body around the
      // injected controls, and per-button listeners on the replaced nodes go
      // silent, so control actions must not depend on node-level listeners.
      if (!globalThis.__dshWindowControlsBound) {
        globalThis.__dshWindowControlsBound = true;
        document.addEventListener('click', (event) => {
          const button = event.target.closest?.('#dsh-window-controls button[data-window-action]');
          if (!button) return;
          const action = button.dataset.windowAction;
          const request = bridge.windowControl(action);
          if (action === 'close') void request.catch(() => {});
          else void request.then(renderWindowState);
        });
      }
      void bridge.windowControl('get-state').then(renderWindowState);
      const unsubscribe = bridge.onWindowState?.(renderWindowState);
      if (unsubscribe) window.addEventListener('beforeunload', unsubscribe, { once: true });
    }
  }`)
}


let insertedThemeCssKeys = []

async function applyDesktopTheme(window) {
  await window.webContents.executeJavaScript(
    "document.body.setAttribute('data-dsh-desktop-codex-theme', '')",
  )
  for (const key of insertedThemeCssKeys.splice(0)) {
    await window.webContents.removeInsertedCSS(key).catch(() => undefined)
  }
  insertedThemeCssKeys.push(await window.webContents.insertCSS(DESKTOP_THEME_CSS))
  insertedThemeCssKeys.push(await window.webContents.insertCSS(WINDOW_CONTROLS_CSS))
  await installWindowControls(window)
  await installTopActions(window)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('before-quit', (event) => {
    if (allowQuit) return
    event.preventDefault()
    void stopBackend().finally(() => {
      allowQuit = true
      app.quit()
    })
  })

  app.on('window-all-closed', () => app.quit())

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      // A taskbar button whose AppUserModelID matches an installed shortcut
      // shows that shortcut's static icon and ignores `setIcon`, which pins
      // the black whale over the theme-adaptive one; both launch modes use a
      // window-only ID so `applyThemeIcon` always wins.
      app.setAppUserModelId(app.isPackaged ? 'io.github.luo-ross.dshdesktop.window' : 'io.github.luo-ross.dshdesktop.dev')
    }
    Menu.setApplicationMenu(null)
    const cachedBackend = backendRequiredPaths(app.isPackaged
      ? join(process.resourcesPath, 'backend')
      : join(app.getAppPath(), '..', 'cli')).every(path => existsSync(path))
    mainWindow = await createWindow({ cachedBackend })
    nativeTheme.on('updated', () => { applyThemeIcon(mainWindow) })
    updaterController = createUpdaterController({
      updater: autoUpdater,
      app,
      getWindow: () => mainWindow,
      showMessageBox: (window, options) => dialog.showMessageBox(window, options),
      stopBackend,
      permitQuit: () => { allowQuit = true },
    })
    // Returning to the window silently rechecks after the minimum gap, so a
    // release published while the app ran is found within seconds of focus
    // instead of waiting out the six-hour interval.
    mainWindow.on('focus', () => {
      void updaterController?.checkIfStale(DEFAULT_FOCUS_RECHECK_MIN_INTERVAL_MS)
    })
    try {
      await prepareBackendRoot()
      updateStartupStatus(72)
      backendUrl = await startBackend()
      updateStartupStatus(90)
      await waitForBackendHttp(backendUrl)
      if (!mainWindow.isDestroyed()) {
        await mainWindow.loadURL(backendUrl)
        updaterController.start()
      }
    } catch (error) {
      dialog.showErrorBox(
        'DSH 启动失败',
        error instanceof Error ? error.message : String(error),
      )
      app.quit()
    }
  })
}
