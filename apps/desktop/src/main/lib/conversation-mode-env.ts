import type { ChatAgentProviderSupport, DesktopCapabilitiesResult } from '@planetz/shared'

const CONVERSATION_MODE_ENV = 'PLANETZ_CHAT_MODE'
const CHAT_AGENT_ENV = 'PLANETZ_CHAT_AGENT_ENABLED'
const CHAT_GATEWAY_ENV = 'PLANETZ_CHAT_GATEWAY'

export type ChatGatewayCapability = 'auto' | 'mock' | 'orbit'

/** True when the env value explicitly turns a product feature off (`0`, `false`, `off`). */
function isEnvOptOut(value: string | undefined): boolean {
  if (value === undefined) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '0' || normalized === 'false' || normalized === 'off'
}

/**
 * Conversation Mode (real Orbit chat) is on for end users by default.
 * Set `PLANETZ_CHAT_MODE=0` to force the in-memory mock gateway (UI-only work).
 */
export function isConversationModeEnabled(): boolean {
  return !isEnvOptOut(process.env[CONVERSATION_MODE_ENV])
}

/**
 * Chat agent (isolated edit) is on by default when conversation mode is on.
 * Set `PLANETZ_CHAT_AGENT_ENABLED=0` to hide the agent mode in the composer.
 */
export function isChatAgentModeEnabled(): boolean {
  return isConversationModeEnabled() && !isEnvOptOut(process.env[CHAT_AGENT_ENV])
}

const CHAT_AGENT_SUPPORT_BY_PROVIDER: Record<string, ChatAgentProviderSupport> = {
  ollama: 'unsupported',
  'claude-sdk': 'edit',
  cursor: 'edit',
  codex: 'readonly',
  copilot: 'readonly',
  opencode: 'readonly',
}

export function resolveChatAgentSupportByProvider(): DesktopCapabilitiesResult['chatAgentSupportByProvider'] {
  return { ...CHAT_AGENT_SUPPORT_BY_PROVIDER }
}

/** Renderer chat gateway selection; unset or unknown values resolve to `auto`. */
export function resolveChatGatewayCapability(): ChatGatewayCapability {
  const raw = process.env[CHAT_GATEWAY_ENV]?.trim().toLowerCase()
  if (raw === 'mock' || raw === 'orbit') return raw
  return 'auto'
}
