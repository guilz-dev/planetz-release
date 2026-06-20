import { STATE_BROADCAST_THROTTLE_MS } from '@planetz/shared'
import type { BrowserWindow } from 'electron'
import type { AppSession } from '../app-session.js'

export function createBroadcastThrottle(
  session: AppSession,
  getWindow: () => BrowserWindow | null,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false

  return {
    broadcastNow() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pending = false
      session.broadcast(getWindow())
    },
    broadcastThrottled() {
      if (timer) {
        pending = true
        return
      }
      session.broadcast(getWindow())
      timer = setTimeout(() => {
        timer = null
        if (pending) {
          pending = false
          session.broadcast(getWindow())
        }
      }, STATE_BROADCAST_THROTTLE_MS)
    },
  }
}
