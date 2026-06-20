import type { BrowserWindow } from 'electron'
import type { AppSession } from '../app-session.js'

const MOCK_ANIMATOR_MS = 4_000

let timer: ReturnType<typeof setInterval> | null = null

export function stopMockAnimatorLoop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function startMockAnimatorLoop(
  session: AppSession,
  _getWindow: () => BrowserWindow | null,
): void {
  stopMockAnimatorLoop()
  timer = setInterval(() => {
    if (!session.workspacePath) return
    session.advanceMockTimeline()
    void session.refreshAndNotify()
  }, MOCK_ANIMATOR_MS)
}
