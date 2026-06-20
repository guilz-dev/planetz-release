import type { ChatAgentProviderSupport } from './ipc-schemas.js'
import type { ChatSessionMode } from './session-policy.js'

export interface ChatAgentCapabilityInput {
  conversationModeEnabled: boolean
  chatAgentEnabled: boolean
  provider: string
  chatAgentSupportByProvider?: Record<string, ChatAgentProviderSupport>
}

/** Whether the user may select Chat agent mode for the current provider. */
export function isChatAgentModeSelectable(input: ChatAgentCapabilityInput): boolean {
  if (!input.conversationModeEnabled || !input.chatAgentEnabled) return false
  const support = input.chatAgentSupportByProvider?.[input.provider.trim()]
  return support === 'edit'
}

/** Falls back to interactive when agent mode is not allowed (flags or provider). */
export function coerceChatModeForCapabilities(
  mode: ChatSessionMode,
  input: ChatAgentCapabilityInput,
): ChatSessionMode {
  if (mode !== 'agent') return mode
  return isChatAgentModeSelectable(input) ? 'agent' : 'interactive'
}

export type ChatAgentModeDisabledReason = 'ollama' | 'provider'

/** UI hint when agent mode is listed but not selectable for the current provider. */
export function resolveChatAgentModeDisabledReason(input: {
  chatAgentEnabled: boolean
  provider: string
  chatAgentSupportByProvider?: Record<string, ChatAgentProviderSupport>
}): ChatAgentModeDisabledReason | null {
  if (!input.chatAgentEnabled) return null
  const provider = input.provider.trim()
  const support = input.chatAgentSupportByProvider?.[provider]
  if (support === 'edit') return null
  if (provider === 'ollama' || support === 'unsupported') return 'ollama'
  return 'provider'
}
