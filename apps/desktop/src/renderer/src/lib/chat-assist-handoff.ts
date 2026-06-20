import type { ActiveView, ChatAssistHandoff } from '../store/app-store.js'

export type QueueChatAssistHandoffActions = {
  setChatAssistHandoff: (handoff: ChatAssistHandoff | null) => void
  setChatHandoffError: (message: string | null) => void
  setActiveView: (view: ActiveView) => void
}

/** One-shot navigation into Chat with a pending assist handoff payload. */
export function queueChatAssistHandoff(
  handoff: ChatAssistHandoff,
  actions: QueueChatAssistHandoffActions,
): void {
  actions.setChatHandoffError(null)
  actions.setChatAssistHandoff(handoff)
  actions.setActiveView('spec-studio')
}

export type ChatHandoffStartResult = { ok: true } | { ok: false; message: string }

/** Returned by startThreadFromHandoff when branch/model/workspace are not ready yet. */
export const CHAT_HANDOFF_NOT_READY = 'CHAT_HANDOFF_NOT_READY'

export function resolveChatHandoffErrorMessage(
  message: string,
  options: { notReady: string; failed: string },
): string {
  if (message === CHAT_HANDOFF_NOT_READY) return options.notReady
  return message.trim() || options.failed
}
