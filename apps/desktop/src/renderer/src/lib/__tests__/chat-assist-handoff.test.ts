import { describe, expect, it, vi } from 'vitest'
import {
  CHAT_HANDOFF_NOT_READY,
  queueChatAssistHandoff,
  resolveChatHandoffErrorMessage,
} from '../chat-assist-handoff.js'

describe('queueChatAssistHandoff', () => {
  it('routes assist handoff to spec studio', () => {
    const setActiveView = vi.fn()
    queueChatAssistHandoff(
      { sourceContext: 'Issue body', workspacePath: '/repo' },
      {
        setChatAssistHandoff: vi.fn(),
        setChatHandoffError: vi.fn(),
        setActiveView,
      },
    )
    expect(setActiveView).toHaveBeenCalledWith('spec-studio')
  })
})

describe('resolveChatHandoffErrorMessage', () => {
  it('maps not-ready sentinel to localized copy', () => {
    expect(
      resolveChatHandoffErrorMessage(CHAT_HANDOFF_NOT_READY, {
        notReady: 'Setup loading',
        failed: 'Failed',
      }),
    ).toBe('Setup loading')
  })

  it('falls back to failed message when empty', () => {
    expect(
      resolveChatHandoffErrorMessage('   ', {
        notReady: 'Setup loading',
        failed: 'Failed',
      }),
    ).toBe('Failed')
  })
})
