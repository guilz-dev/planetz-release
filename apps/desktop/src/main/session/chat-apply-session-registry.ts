import type { ChatApplySessionMeta } from '@planetz/shared'

const metaByComposerSessionId = new Map<string, ChatApplySessionMeta>()

export function registerChatApplySessionMeta(meta: ChatApplySessionMeta): void {
  metaByComposerSessionId.set(meta.composerSessionId, meta)
}

export function getChatApplySessionMeta(
  composerSessionId: string,
): ChatApplySessionMeta | undefined {
  return metaByComposerSessionId.get(composerSessionId)
}

export function unregisterChatApplySessionMeta(composerSessionId: string): void {
  metaByComposerSessionId.delete(composerSessionId)
}

export function clearChatApplySessionRegistryForTests(): void {
  metaByComposerSessionId.clear()
}
