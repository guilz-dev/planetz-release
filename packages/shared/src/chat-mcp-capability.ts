/** Whether chat agent sessions may pass MCP servers to headless for this provider. */
export function isChatMcpEnabledForProvider(providerId: string): boolean {
  const normalized = providerId.trim().toLowerCase()
  return normalized === 'claude-sdk' || normalized === 'claude'
}

export function resolveChatMcpEnabledByProvider(): Record<string, boolean> {
  return {
    'claude-sdk': true,
    claude: true,
    ollama: false,
    codex: false,
    cursor: false,
    copilot: false,
    opencode: false,
    mock: false,
  }
}

export function isChatMcpEnabledForProviderWithMap(
  providerId: string,
  chatMcpEnabledByProvider?: Record<string, boolean>,
): boolean {
  const trimmed = providerId.trim()
  if (chatMcpEnabledByProvider && trimmed in chatMcpEnabledByProvider) {
    return chatMcpEnabledByProvider[trimmed] === true
  }
  const lower = trimmed.toLowerCase()
  if (chatMcpEnabledByProvider) {
    for (const [key, enabled] of Object.entries(chatMcpEnabledByProvider)) {
      if (key.toLowerCase() === lower) return enabled === true
    }
  }
  return isChatMcpEnabledForProvider(providerId)
}

export type ChatMcpDisabledReason = 'ollama' | 'provider'

/** UI hint when agent mode is active but MCP cannot run for the current provider. */
export function resolveChatMcpDisabledReason(input: {
  provider: string
  chatMcpEnabledByProvider?: Record<string, boolean>
}): ChatMcpDisabledReason | null {
  if (isChatMcpEnabledForProviderWithMap(input.provider, input.chatMcpEnabledByProvider)) {
    return null
  }
  if (input.provider.trim().toLowerCase() === 'ollama') return 'ollama'
  return 'provider'
}
