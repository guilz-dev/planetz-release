import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { ElectronApplication, Page } from '@playwright/test'
import { MAIN_ENTRY } from './paths.ts'
import { prepareSmokeE2eIsolation } from './workspace-fixture.ts'

const require = createRequire(import.meta.url)

/** Must match `PLANETZ_E2E_WINDOW_SIZE_ENV` in `src/main/lib/resolve-e2e-window-size.ts`. */
const PLANETZ_E2E_WINDOW_SIZE_ENV = 'PLANETZ_E2E_WINDOW_SIZE'

function resolveElectronExecutable(): string {
  return require('electron') as string
}

export interface LaunchedPlanetzApp {
  app: ElectronApplication
  window: Page
  workspacePath: string
  cleanup: () => void
}

export interface LaunchPlanetzAppOptions {
  recordVideo?: {
    dir: string
    size: { width: number; height: number }
  }
  viewport?: { width: number; height: number }
}

function buildLaunchEnv(
  workspacePath: string,
  userDataPath: string,
  windowSize?: { width: number; height: number },
): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  env.PLANETZ_WORKSPACE = workspacePath
  env.PLANETZ_MOCK = '1'
  // Must match `PLANETZ_E2E_USER_DATA_ENV` in `src/main/lib/apply-e2e-runtime-env.ts`.
  env.PLANETZ_E2E_USER_DATA = userDataPath
  env.NODE_ENV = 'production'
  if (windowSize) {
    env[PLANETZ_E2E_WINDOW_SIZE_ENV] = `${windowSize.width}x${windowSize.height}`
  }
  return env
}

/** Launch a built Planetz desktop app against the smoke workspace fixture. */
export async function launchPlanetzApp(
  options: LaunchPlanetzAppOptions = {},
): Promise<LaunchedPlanetzApp> {
  if (!existsSync(MAIN_ENTRY)) {
    throw new Error(
      `[desktop-e2e] missing ${MAIN_ENTRY}. Run: pnpm --filter @planetz/desktop run build`,
    )
  }

  const { _electron: electron } = await import('playwright')
  const { workspacePath, userDataPath, cleanup } = prepareSmokeE2eIsolation()
  const captureWindowSize = options.viewport ?? options.recordVideo?.size

  if (options.recordVideo) {
    mkdirSync(options.recordVideo.dir, { recursive: true })
  }

  const app = await electron.launch({
    executablePath: resolveElectronExecutable(),
    args: [MAIN_ENTRY],
    env: buildLaunchEnv(workspacePath, userDataPath, captureWindowSize),
    timeout: 120_000,
    ...(options.recordVideo
      ? {
          recordVideo: {
            dir: options.recordVideo.dir,
            size: options.recordVideo.size,
          },
        }
      : {}),
  })

  const window = await app.firstWindow({ timeout: 60_000 })
  await window.waitForLoadState('domcontentloaded')

  if (options.viewport) {
    await window.setViewportSize(options.viewport)
  }

  return { app, window, workspacePath, cleanup }
}
