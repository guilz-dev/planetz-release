import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { MAIN_ENTRY } from '../helpers/paths.ts'
import { prepareSmokeE2eIsolation } from '../helpers/workspace-fixture.ts'

const require = createRequire(import.meta.url)

function resolveElectronExecutable(): string {
  return require('electron') as string
}

test.describe('chat gateway capability', () => {
  test('exposes PLANETZ_CHAT_GATEWAY override via desktop capabilities', async () => {
    if (!existsSync(MAIN_ENTRY)) {
      throw new Error(
        `[desktop-e2e] missing ${MAIN_ENTRY}. Run: pnpm --filter @planetz/desktop run build`,
      )
    }

    const { workspacePath, userDataPath, cleanup } = prepareSmokeE2eIsolation()
    const { _electron: electron } = await import('playwright')
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    env.PLANETZ_WORKSPACE = workspacePath
    env.PLANETZ_MOCK = '1'
    env.PLANETZ_CHAT_GATEWAY = 'mock'
    env.PLANETZ_E2E_USER_DATA = userDataPath
    env.NODE_ENV = 'production'

    const app = await electron.launch({
      executablePath: resolveElectronExecutable(),
      args: [MAIN_ENTRY],
      env,
      timeout: 120_000,
    })

    try {
      const window = await app.firstWindow({ timeout: 60_000 })
      await window.waitForLoadState('domcontentloaded')
      await window.waitForFunction(() => typeof window.orbit !== 'undefined', null, {
        timeout: 60_000,
      })
      const capabilities = await window.evaluate(async () => window.orbit.getDesktopCapabilities())
      expect(capabilities.chatGateway).toBe('mock')
    } finally {
      await app.close()
      cleanup()
    }
  })
})
