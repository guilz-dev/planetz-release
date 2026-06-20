export const UI_STATE_KV_KEY = 'ui.state'
export const MOCK_QUEUE_INITIALIZED_KV_KEY = 'mock_queue.initialized'
export const KIRO_SPEC_APPROVAL_SNAPSHOT_KV_KEY = 'kiro.spec_approval_snapshot'
export const SPEC_STUDIO_INTENT_DRAFT_KV_PREFIX = 'spec_studio.intent_draft.'

export function specStudioIntentDraftKvKey(threadId: string): string {
  return `${SPEC_STUDIO_INTENT_DRAFT_KV_PREFIX}${threadId}`
}
