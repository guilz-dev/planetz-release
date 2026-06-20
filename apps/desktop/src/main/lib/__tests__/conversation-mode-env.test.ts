import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isChatAgentModeEnabled,
  isConversationModeEnabled,
  resolveChatGatewayCapability,
} from '../conversation-mode-env.js'

describe('conversation-mode-env', () => {
  let previousChatMode: string | undefined
  let previousChatAgent: string | undefined
  let previousChatGateway: string | undefined

  beforeEach(() => {
    previousChatMode = process.env.PLANETZ_CHAT_MODE
    previousChatAgent = process.env.PLANETZ_CHAT_AGENT_ENABLED
    previousChatGateway = process.env.PLANETZ_CHAT_GATEWAY
    delete process.env.PLANETZ_CHAT_MODE
    delete process.env.PLANETZ_CHAT_AGENT_ENABLED
    delete process.env.PLANETZ_CHAT_GATEWAY
  })

  afterEach(() => {
    if (previousChatMode === undefined) delete process.env.PLANETZ_CHAT_MODE
    else process.env.PLANETZ_CHAT_MODE = previousChatMode
    if (previousChatAgent === undefined) delete process.env.PLANETZ_CHAT_AGENT_ENABLED
    else process.env.PLANETZ_CHAT_AGENT_ENABLED = previousChatAgent
    if (previousChatGateway === undefined) delete process.env.PLANETZ_CHAT_GATEWAY
    else process.env.PLANETZ_CHAT_GATEWAY = previousChatGateway
  })

  it('defaults chat gateway capability to auto and conversation mode on', () => {
    expect(resolveChatGatewayCapability()).toBe('auto')
    expect(isConversationModeEnabled()).toBe(true)
    expect(isChatAgentModeEnabled()).toBe(true)
  })

  it('disables conversation mode when PLANETZ_CHAT_MODE=0', () => {
    process.env.PLANETZ_CHAT_MODE = '0'
    expect(isConversationModeEnabled()).toBe(false)
    expect(isChatAgentModeEnabled()).toBe(false)
  })

  it('disables agent mode when PLANETZ_CHAT_AGENT_ENABLED=0', () => {
    process.env.PLANETZ_CHAT_AGENT_ENABLED = '0'
    expect(isConversationModeEnabled()).toBe(true)
    expect(isChatAgentModeEnabled()).toBe(false)
  })

  it('reads PLANETZ_CHAT_GATEWAY override', () => {
    process.env.PLANETZ_CHAT_GATEWAY = 'orbit'
    expect(resolveChatGatewayCapability()).toBe('orbit')
    process.env.PLANETZ_CHAT_GATEWAY = 'unknown-value'
    expect(resolveChatGatewayCapability()).toBe('auto')
  })
})
