import type { BrowserWindow } from 'electron'
import type { AppSession } from '../app-session.js'
import { createBroadcastThrottle } from '../lib/broadcast-throttle.js'

export interface IpcContext {
  session: AppSession
  getWindow: () => BrowserWindow | null
  broadcast: ReturnType<typeof createBroadcastThrottle>
}

export function createIpcContext(
  session: AppSession,
  getWindow: () => BrowserWindow | null,
): IpcContext {
  return {
    session,
    getWindow,
    broadcast: createBroadcastThrottle(session, getWindow),
  }
}

export function broadcastAfterMutation(ctx: IpcContext): void {
  ctx.broadcast.broadcastNow()
}
