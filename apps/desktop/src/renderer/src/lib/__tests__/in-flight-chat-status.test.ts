import { describe, expect, it } from 'vitest'
import type { ChatStreamingTurn } from '../chat-stream-types'
import {
  buildInFlightPresentation,
  deriveInFlightChatStatus,
  shouldShowInFlightAssistantRow,
} from '../in-flight-chat-status'

function streamingTurn(
  partial: Partial<ChatStreamingTurn> & Pick<ChatStreamingTurn, 'text' | 'activities'>,
): ChatStreamingTurn {
  return {
    id: 'stream_1',
    role: 'assistant',
    text: partial.text,
    activities: partial.activities,
  }
}

describe('in-flight-chat-status', () => {
  it('shows in-flight row for streaming, retrying, and cancelling', () => {
    expect(shouldShowInFlightAssistantRow('streaming')).toBe(true)
    expect(shouldShowInFlightAssistantRow('retrying')).toBe(true)
    expect(shouldShowInFlightAssistantRow('cancelling')).toBe(true)
    expect(shouldShowInFlightAssistantRow('idle')).toBe(false)
    expect(shouldShowInFlightAssistantRow('error')).toBe(false)
  })

  it('builds a unified in-flight presentation object', () => {
    expect(buildInFlightPresentation('idle', null)).toBeNull()
    expect(buildInFlightPresentation('streaming', null)).toEqual({
      status: 'thinking',
      streamingTurn: null,
    })
  })

  it('derives thinking for empty placeholder before stream events', () => {
    expect(deriveInFlightChatStatus('streaming', null)).toBe('thinking')
    expect(deriveInFlightChatStatus('streaming', streamingTurn({ text: '', activities: [] }))).toBe(
      'thinking',
    )
  })

  it('derives tool_running when latest live activity is tool_use and text is empty', () => {
    expect(
      deriveInFlightChatStatus(
        'streaming',
        streamingTurn({
          text: '',
          activities: [{ kind: 'tool_use', tool: 'Read', id: 't1' }],
        }),
      ),
    ).toBe('tool_running')
  })

  it('derives responding once assistant text starts streaming', () => {
    expect(
      deriveInFlightChatStatus(
        'streaming',
        streamingTurn({
          text: 'partial',
          activities: [{ kind: 'tool_use', tool: 'Read', id: 't1' }],
        }),
      ),
    ).toBe('responding')
  })

  it('derives retrying and cancelling from stream lifecycle state', () => {
    expect(deriveInFlightChatStatus('retrying', null)).toBe('retrying')
    expect(deriveInFlightChatStatus('cancelling', null)).toBe('cancelling')
  })

  it('keeps header on responding when tool_output arrives after text started', () => {
    expect(
      deriveInFlightChatStatus(
        'streaming',
        streamingTurn({
          text: 'answer',
          activities: [
            { kind: 'tool_use', tool: 'Read', id: 't1' },
            { kind: 'tool_output', tool: 'Read', output: 'file contents' },
          ],
        }),
      ),
    ).toBe('responding')
  })

  it('treats whitespace-only partial text as thinking', () => {
    expect(
      deriveInFlightChatStatus('streaming', streamingTurn({ text: '   ', activities: [] })),
    ).toBe('thinking')
  })

  it('keeps header on responding when tool_result or error activities arrive after text', () => {
    expect(
      deriveInFlightChatStatus(
        'streaming',
        streamingTurn({
          text: 'answer',
          activities: [{ kind: 'tool_result', content: 'done', isError: false }],
        }),
      ),
    ).toBe('responding')
    expect(
      deriveInFlightChatStatus(
        'streaming',
        streamingTurn({
          text: 'answer',
          activities: [{ kind: 'error', message: 'tool failed' }],
        }),
      ),
    ).toBe('responding')
  })
})
