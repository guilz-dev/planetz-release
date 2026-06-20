import { describe, expect, it } from 'vitest'
import {
  isChatMcpEnabledForProvider,
  isChatMcpEnabledForProviderWithMap,
  resolveChatMcpDisabledReason,
  resolveChatMcpEnabledByProvider,
} from '../chat-mcp-capability.js'

describe('chat MCP capability', () => {
  it('enables MCP only for claude providers by default', () => {
    expect(isChatMcpEnabledForProvider('claude-sdk')).toBe(true)
    expect(isChatMcpEnabledForProvider('ollama')).toBe(false)
    expect(resolveChatMcpEnabledByProvider()).toMatchObject({
      'claude-sdk': true,
      ollama: false,
    })
  })

  it('respects capabilities map overrides', () => {
    expect(isChatMcpEnabledForProviderWithMap('custom', { custom: true })).toBe(true)
    expect(isChatMcpEnabledForProviderWithMap('claude-sdk', { 'claude-sdk': false })).toBe(false)
  })

  it('returns UI disabled reasons', () => {
    expect(
      resolveChatMcpDisabledReason({
        provider: 'claude-sdk',
        chatMcpEnabledByProvider: resolveChatMcpEnabledByProvider(),
      }),
    ).toBeNull()
    expect(
      resolveChatMcpDisabledReason({
        provider: 'ollama',
        chatMcpEnabledByProvider: resolveChatMcpEnabledByProvider(),
      }),
    ).toBe('ollama')
    expect(
      resolveChatMcpDisabledReason({
        provider: 'codex',
        chatMcpEnabledByProvider: resolveChatMcpEnabledByProvider(),
      }),
    ).toBe('provider')
  })
})
