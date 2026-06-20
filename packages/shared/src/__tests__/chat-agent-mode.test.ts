import { describe, expect, it } from 'vitest'
import {
  coerceChatModeForCapabilities,
  isChatAgentModeSelectable,
  resolveChatAgentModeDisabledReason,
} from '../chat-agent-mode.js'

const baseCapabilities = {
  conversationModeEnabled: true,
  chatAgentEnabled: true,
  provider: 'claude-sdk',
  chatAgentSupportByProvider: {
    ollama: 'unsupported' as const,
    'claude-sdk': 'edit' as const,
    codex: 'readonly' as const,
  },
}

describe('chat-agent-mode', () => {
  it('allows agent mode when flags and provider support edit', () => {
    expect(isChatAgentModeSelectable(baseCapabilities)).toBe(true)
    expect(coerceChatModeForCapabilities('agent', baseCapabilities)).toBe('agent')
  })

  it('coerces agent to interactive when chat mode or agent flag is off', () => {
    expect(
      coerceChatModeForCapabilities('agent', {
        ...baseCapabilities,
        conversationModeEnabled: false,
      }),
    ).toBe('interactive')
    expect(
      coerceChatModeForCapabilities('agent', { ...baseCapabilities, chatAgentEnabled: false }),
    ).toBe('interactive')
  })

  it('coerces agent to interactive for unsupported providers', () => {
    expect(
      coerceChatModeForCapabilities('agent', { ...baseCapabilities, provider: 'ollama' }),
    ).toBe('interactive')
    expect(coerceChatModeForCapabilities('agent', { ...baseCapabilities, provider: 'codex' })).toBe(
      'interactive',
    )
  })

  it('leaves non-agent modes unchanged', () => {
    expect(coerceChatModeForCapabilities('spec', baseCapabilities)).toBe('spec')
    expect(coerceChatModeForCapabilities('interactive', baseCapabilities)).toBe('interactive')
  })

  it('maps disabled reasons for agent menu', () => {
    expect(
      resolveChatAgentModeDisabledReason({
        chatAgentEnabled: false,
        provider: 'claude-sdk',
      }),
    ).toBeNull()
    expect(
      resolveChatAgentModeDisabledReason({
        chatAgentEnabled: true,
        provider: 'ollama',
        chatAgentSupportByProvider: baseCapabilities.chatAgentSupportByProvider,
      }),
    ).toBe('ollama')
    expect(
      resolveChatAgentModeDisabledReason({
        chatAgentEnabled: true,
        provider: 'codex',
        chatAgentSupportByProvider: baseCapabilities.chatAgentSupportByProvider,
      }),
    ).toBe('provider')
  })
})
