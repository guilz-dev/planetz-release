import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readPlanetzEnv } from '@planetz/shared'
import { app, BrowserWindow, shell } from 'electron'
import { AppSession } from './app-session.js'
import { createIpcContext } from './ipc/ipc-context.js'
import { registerIpc } from './ipc/register-ipc.js'
import { applyDarwinDockIcon, resolveWindowIconPng } from './lib/app-icon.js'
import { applyE2eRuntimeEnvIfConfigured } from './lib/apply-e2e-runtime-env.js'
import { startMockAnimatorLoop, stopMockAnimatorLoop } from './lib/mock-animator-loop.js'
import { applyPackagedNodeBinaryEnv } from './lib/packaged-node-binary.js'
import { resolveE2eWindowSizeFromEnv } from './lib/resolve-e2e-window-size.js'
import {
  focusExistingMainWindow,
  registerSingleInstanceAppHandlers,
} from './lib/single-instance.js'
import { TaskFailureDesktopNotifier } from './lib/task-failure-desktop-notifier.js'
import { dispatchTaskFailureNotifications } from './lib/task-failure-notification-dispatch.js'

applyE2eRuntimeEnvIfConfigured()
applyPackagedNodeBinaryEnv()

let mainWindow: BrowserWindow | null = null
let session!: AppSession
let ipcContext!: ReturnType<typeof createIpcContext>
let taskFailureNotifier: TaskFailureDesktopNotifier | null = null

const ownsSingleInstanceLock = registerSingleInstanceAppHandlers(() => mainWindow)

/** electron-vite dev reloads the renderer on preload rebuild; preload only loads at window creation. */
const ELECTRON_VITE_PRELOAD_HOT_RELOAD = 'electron-vite&type=hot-reload'

function registerDevPreloadHotReload(): void {
  if (!process.env.ELECTRON_RENDERER_URL) return

  process.on('message', (msg: unknown) => {
    if (msg !== ELECTRON_VITE_PRELOAD_HOT_RELOAD) return

    console.info(
      '[planetz] Preload rebuilt; recreating BrowserWindow so window.orbit picks up new IPC methods.',
    )
    const hadSessionState = Boolean(session.getState())
    const previousWindow = mainWindow

    if (previousWindow && !previousWindow.isDestroyed()) {
      previousWindow.destroy()
    }

    createWindow()

    if (hadSessionState) {
      afterWorkspaceReady()
    }
  })
}

const isElectronViteDev = Boolean(process.env.ELECTRON_RENDERER_URL)

function attachDevWebDiagnostics(win: BrowserWindow): void {
  if (!isElectronViteDev) return

  const { webContents } = win
  webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[planetz] renderer did-fail-load: ${code} ${description} (${url})`)
    if (!win.isDestroyed()) {
      webContents.openDevTools({ mode: 'detach' })
    }
  })
  webContents.on('did-finish-load', () => {
    console.info(`[planetz] renderer loaded: ${webContents.getURL()}`)
    void webContents
      .executeJavaScript(
        `({
          hasOrbit: typeof window.orbit !== "undefined",
          hasComposerStream: typeof window.orbit?.onComposerSessionStream === "function",
          bridgeRevision: window.orbitMeta?.revision ?? null,
        })`,
      )
      .then((bridge) => {
        console.info(
          `[planetz] window.orbit available: ${bridge.hasOrbit}, onComposerSessionStream: ${bridge.hasComposerStream}, bridgeRevision: ${bridge.bridgeRevision ?? 'n/a'}`,
        )
        if (!bridge.hasComposerStream) {
          console.warn(
            '[planetz] Chat live streaming requires onComposerSessionStream on preload. Stop dev, ensure apps/desktop/out/preload is rebuilt, then restart Electron.',
          )
        }
      })
      .catch(() => undefined)
  })
  webContents.on('render-process-gone', (_event, details) => {
    console.error('[planetz] render-process-gone:', details)
  })
}

function revealMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show()
  }
}

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.js')
  if (!existsSync(preloadPath)) {
    console.error(`[planetz] Preload script missing: ${preloadPath}`)
  }

  const icon = resolveWindowIconPng()
  const e2eWindowSize = resolveE2eWindowSizeFromEnv()
  const windowWidth = e2eWindowSize?.width ?? 1280
  const windowHeight = e2eWindowSize?.height ?? 800
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    show: false,
    backgroundColor: '#24273a',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  attachDevWebDiagnostics(mainWindow)

  mainWindow.webContents.on('preload-error', (_event, path, error) => {
    console.error(`[planetz] Preload failed (${path}):`, error)
  })

  mainWindow.on('ready-to-show', revealMainWindow)
  if (isElectronViteDev) {
    mainWindow.webContents.once('did-finish-load', revealMainWindow)
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    console.info(`[planetz] loading renderer dev URL: ${rendererUrl}`)
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  session.bindMainWindow(() => mainWindow)
}

async function openStartupWorkspace(): Promise<boolean> {
  const envWorkspace = readPlanetzEnv('WORKSPACE')
  if (envWorkspace) {
    await session.openWorkspace(envWorkspace)
    return true
  }
  const restored = await session.openLastWorkspaceIfAvailable()
  return restored !== null
}

function afterWorkspaceReady(): void {
  ipcContext.broadcast.broadcastNow()
  if (session.shouldRunMockAnimator()) {
    startMockAnimatorLoop(session, () => mainWindow)
  }
}

function registerAppLifecycleHandlers(): void {
  app.on('window-all-closed', () => {
    stopMockAnimatorLoop()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  let quitting = false
  app.on('before-quit', (event) => {
    stopMockAnimatorLoop()
    if (quitting || !session.workspacePath) return
    event.preventDefault()
    quitting = true
    void session.dispose().finally(() => {
      app.exit(0)
    })
  })
}

function startApp(): void {
  void app
    .whenReady()
    .then(async () => {
      const enqueueTraceEnabled =
        process.env.PLANETZ_TRACE_ENQUEUE === '1' ||
        (process.env.PLANETZ_TRACE_ENQUEUE !== '0' &&
          process.env.NODE_ENV_ELECTRON_VITE === 'development')
      console.info(
        `[planetz] enqueue trace ${enqueueTraceEnabled ? 'enabled' : 'disabled'} (PLANETZ_TRACE_ENQUEUE=${process.env.PLANETZ_TRACE_ENQUEUE ?? ''}, NODE_ENV_ELECTRON_VITE=${process.env.NODE_ENV_ELECTRON_VITE ?? ''})`,
      )
      applyDarwinDockIcon(resolveWindowIconPng())
      registerIpc(ipcContext)
      taskFailureNotifier = new TaskFailureDesktopNotifier((taskId) => {
        focusExistingMainWindow(() => mainWindow)
        session.emitUiFocusTask(taskId)
        void session.persistUiState({ selectedTaskId: taskId }).then(() => {
          ipcContext.broadcast.broadcastNow()
        })
      })
      session.setStateChangeListener(() => {
        if (taskFailureNotifier) {
          dispatchTaskFailureNotifications(session, taskFailureNotifier)
        }
        ipcContext.broadcast.broadcastNow()
      })

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
          if (session.getState()) {
            afterWorkspaceReady()
          }
        }
      })

      createWindow()
      // Track the startup workspace restore so `workspace:get` can await it.
      // Otherwise the renderer hydrates and decides onboarding-vs-dashboard before
      // the (slow) restore finishes, flashing the onboarding wizard every launch.
      const startupRestore = openStartupWorkspace()
        .then((opened) => {
          if (opened) afterWorkspaceReady()
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
          console.error('[planetz] workspace open failed:', message)
        })
      session.markStartupSettled(startupRestore)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      console.error('[planetz] startup failed:', message)
    })
}

function bootstrapDesktopMain(): void {
  session = new AppSession()
  ipcContext = createIpcContext(session, () => mainWindow)
  registerDevPreloadHotReload()
  registerAppLifecycleHandlers()
  startApp()
}

if (ownsSingleInstanceLock) {
  bootstrapDesktopMain()
}
