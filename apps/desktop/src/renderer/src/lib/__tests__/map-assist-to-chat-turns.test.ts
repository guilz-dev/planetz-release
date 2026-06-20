import { describe, expect, it } from 'vitest'
import {
  mapAssistSessionToChatTurns,
  mapAssistTurnsToChatTurns,
  mapConversationLinesToChatTurns,
  mapStartTurnToChatTurns,
} from '../map-assist-to-chat-turns'

describe('map-assist-to-chat-turns', () => {
  it('maps start turn with seed and assistant message', () => {
    const turns = mapStartTurnToChatTurns(
      {
        sessionId: 's1',
        question: '',
        recommendedAnswer: '',
        assistantMessage: 'Hello',
        turnIndex: 0,
        readyToFinalize: true,
      },
      'Seed prompt',
    )
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ role: 'user', content: 'Seed prompt' })
    expect(turns[1]).toMatchObject({ role: 'assistant', content: 'Hello' })
  })

  it('maps Q/A turns with user replies', () => {
    const turns = mapAssistTurnsToChatTurns('s1', [
      { question: 'Q1', recommendedAnswer: 'A1', userReply: 'My answer' },
    ])
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ role: 'user', content: 'My answer' })
    expect(turns[1]).toMatchObject({ role: 'assistant', content: 'A1' })
  })

  it('maps conversation lines in order', () => {
    const turns = mapConversationLinesToChatTurns('s1', [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hey' },
    ])
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant'])
  })

  it('prefers conversation log over Q/A when present', () => {
    const turns = mapAssistSessionToChatTurns({
      sessionId: 's1',
      turns: [{ question: 'Q', recommendedAnswer: 'A' }],
      conversation: [{ role: 'user', content: 'Line' }],
      readyToFinalize: false,
      turnIndex: 0,
    })
    expect(turns).toHaveLength(1)
    expect(turns[0].content).toBe('Line')
  })
})
