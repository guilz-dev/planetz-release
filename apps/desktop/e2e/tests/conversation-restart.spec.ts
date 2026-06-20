import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import {
  E2E_CONVERSATION_RESTART_SESSION_ID,
  E2E_CONVERSATION_RESTART_THREAD_ID,
  seedConversationHistoryForRestartE2e,
} from '../helpers/conversation-history-seed.ts'
import { MAIN_ENTRY } from '../helpers/paths.ts'
import { prepareSmokeE2eIsolation } from '../helpers/workspace-fixture.ts'

const require = createRequire(import.meta.url)

function resolveElectronExecutable(): string {
  return require('electron') as string
}

async function launchWithWorkspace(
  workspacePath: string,
  userDataPath: string,
): Promise<import('@playwright/test').ElectronApplication> {
  if (!existsSync(MAIN_ENTRY)) {
    throw new Error(
      `[desktop-e2e] missing ${MAIN_ENTRY}. Run: pnpm --filter @planetz/desktop run build`,
    )
  }
  const { _electron: electron } = await import('playwright')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  env.PLANETZ_WORKSPACE = workspacePath
  env.PLANETZ_MOCK = '1'
  env.PLANETZ_E2E_USER_DATA = userDataPath
  env.NODE_ENV = 'production'
  return electron.launch({
    executablePath: resolveElectronExecutable(),
    args: [MAIN_ENTRY],
    env,
    timeout: 120_000,
  })
}

test.describe('conversation history restart', () => {
  test('restores ledger threads after app restart', async () => {
    const { workspacePath, userDataPath, cleanup } = prepareSmokeE2eIsolation()
    seedConversationHistoryForRestartE2e(workspacePath)

    const assertHistory = async (page: import('@playwright/test').Page): Promise<void> => {
      await page.waitForFunction(() => typeof window.orbit !== 'undefined', null, {
        timeout: 60_000,
      })
      const list = await page.evaluate(async () => {
        const result = await window.orbit.listConversationHistory()
        return result.threads
      })
      const thread = list.find((row) => row.threadId === E2E_CONVERSATION_RESTART_THREAD_ID)
      expect(thread).toBeTruthy()
      expect(thread?.hasActiveSession).toBe(true)
      expect(thread?.activeSessionId).toBeTruthy()

      const detail = await page.evaluate(async (threadId) => {
        return window.orbit.getConversationHistory({ threadId })
      }, E2E_CONVERSATION_RESTART_THREAD_ID)
      expect(detail.found).toBe(true)
      if (detail.found) {
        expect(detail.turns.some((turn) => turn.content.includes('Hello before restart'))).toBe(
          true,
        )
        expect(detail.thread.activeSessionId).toBe(E2E_CONVERSATION_RESTART_SESSION_ID)
      }

      const resume = await page.evaluate(async (sessionId) => {
        return window.orbit.resumeComposerSession({ sessionId })
      }, E2E_CONVERSATION_RESTART_SESSION_ID)
      expect(resume.sessionId).toBe(E2E_CONVERSATION_RESTART_SESSION_ID)
    }

    const firstApp = await launchWithWorkspace(workspacePath, userDataPath)
    try {
      const firstWindow = await firstApp.firstWindow({ timeout: 60_000 })
      await firstWindow.waitForLoadState('domcontentloaded')
      await assertHistory(firstWindow)
    } finally {
      await firstApp.close()
    }

    const secondApp = await launchWithWorkspace(workspacePath, userDataPath)
    try {
      const secondWindow = await secondApp.firstWindow({ timeout: 60_000 })
      await secondWindow.waitForLoadState('domcontentloaded')
      await assertHistory(secondWindow)
    } finally {
      await secondApp.close()
      cleanup()
    }
  })
})
