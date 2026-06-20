/** Conversation send lifecycle (in-flight IPC). Token display uses `composerSession:stream` push events. */
export type ChatStreamState = 'idle' | 'streaming' | 'cancelling' | 'error' | 'retrying'

/** Minimum time (ms) to keep the cancelling state visible before returning to idle. */
export const CHAT_CANCEL_SETTLE_MS = 150

export function isChatInFlight(state: ChatStreamState): boolean {
  return state === 'streaming' || state === 'retrying' || state === 'cancelling'
}

export function isChatStreamBusy(state: ChatStreamState): boolean {
  return isChatInFlight(state)
}

export function isChatStreamCancellable(state: ChatStreamState): boolean {
  return state === 'streaming' || state === 'retrying'
}
