import { describe, expect, it } from 'vitest'
import {
  chatSessionPolicyToChatMode,
  resolveSessionPolicy,
  resolveSessionToolsProfile,
  sessionPolicyFromChatMode,
} from '../session-policy.js'

describe('session-policy', () => {
  it('defaults missing sessionPolicy to planetz-task-planning', () => {
    expect(resolveSessionPolicy({})).toBe('planetz-task-planning')
  })

  it('maps chat modes to session policies', () => {
    expect(sessionPolicyFromChatMode('interactive')).toBe('planetz-chat-investigate')
    expect(sessionPolicyFromChatMode('agent')).toBe('planetz-chat-agent')
    expect(sessionPolicyFromChatMode('spec')).toBe('planetz-chat-spec')
  })

  it('maps session policies back to chat modes', () => {
    expect(chatSessionPolicyToChatMode('planetz-chat-spec')).toBe('spec')
    expect(chatSessionPolicyToChatMode('planetz-chat-agent')).toBe('agent')
    expect(chatSessionPolicyToChatMode('planetz-chat-investigate')).toBe('interactive')
    expect(chatSessionPolicyToChatMode(undefined)).toBe('interactive')
  })

  it('maps chat session policies to Planetz tools profiles', () => {
    expect(resolveSessionToolsProfile({ sessionPolicy: 'planetz-chat-investigate' })).toBe(
      'planetz-investigate',
    )
    expect(resolveSessionToolsProfile({ sessionPolicy: 'planetz-chat-spec' })).toBe(
      'planetz-readonly',
    )
    expect(resolveSessionToolsProfile({ sessionPolicy: 'planetz-chat-agent' })).toBe(
      'planetz-agent-edit',
    )
  })

  it('prefers explicit toolsProfile over policy map', () => {
    expect(
      resolveSessionToolsProfile({
        sessionPolicy: 'planetz-chat-investigate',
        toolsProfile: 'orbit-default',
      }),
    ).toBe('orbit-default')
  })
})
