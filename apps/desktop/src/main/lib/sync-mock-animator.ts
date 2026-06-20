import type { BrowserWindow } from 'electron'
import type { AppSession } from '../app-session.js'
import { startMockAnimatorLoop, stopMockAnimatorLoop } from './mock-animator-loop.js'

export function syncMockAnimatorLoop(
  session: AppSession,
  getWindow: () => BrowserWindow | null,
): void {
  if (session.shouldRunMockAnimator()) {
    startMockAnimatorLoop(session, getWindow)
  } else {
    stopMockAnimatorLoop()
  }
}
