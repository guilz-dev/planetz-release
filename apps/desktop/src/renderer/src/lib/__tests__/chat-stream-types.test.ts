import { describe, expect, it } from 'vitest'
import { applyComposerStreamLine } from '../chat-stream-types'

describe('applyComposerStreamLine', () => {
  const base = {
    id: 'stream_1',
    role: 'assistant' as const,
    text: '',
    activities: [],
  }

  it('appends text deltas', () => {
    const next = applyComposerStreamLine(base, {
      v: 1,
      sessionId: 's',
      seq: 1,
      event: { type: 'text', data: { text: 'hello' } },
    })
    expect(next.text).toBe('hello')
  })

  it('records tool_use activity', () => {
    const next = applyComposerStreamLine(base, {
      v: 1,
      sessionId: 's',
      seq: 2,
      event: { type: 'tool_use', data: { tool: 'Read', input: {}, id: 't1' } },
    })
    expect(next.activities).toHaveLength(1)
    expect(next.activities[0]).toMatchObject({ kind: 'tool_use', tool: 'Read' })
  })

  it('ignores done lines without mutating state', () => {
    const withText = applyComposerStreamLine(base, {
      v: 1,
      sessionId: 's',
      seq: 1,
      event: { type: 'text', data: { text: 'hello' } },
    })
    const unchanged = applyComposerStreamLine(withText, {
      v: 1,
      sessionId: 's',
      seq: 2,
      done: true,
    })
    expect(unchanged).toBe(withText)
  })

  it('merges consecutive thinking chunks', () => {
    let state = applyComposerStreamLine(base, {
      v: 1,
      sessionId: 's',
      seq: 2,
      event: { type: 'thinking', data: { thinking: 'a' } },
    })
    state = applyComposerStreamLine(state, {
      v: 1,
      sessionId: 's',
      seq: 3,
      event: { type: 'thinking', data: { thinking: 'b' } },
    })
    expect(state.activities).toHaveLength(1)
    expect(state.activities[0]).toMatchObject({ kind: 'thinking', text: 'ab' })
  })
})
