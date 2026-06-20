import { describe, expect, it } from 'vitest'
import { formatRunEventDisplayMessage, truncateRunEventText } from '../run-event-display-message.js'
import type { RunEvent } from '../types.js'

const base: RunEvent = {
  runId: 'r:s',
  runDirSlug: 'r',
  sessionId: 's',
  type: 'log',
  at: '2026-05-27T10:00:00.000Z',
}

describe('formatRunEventDisplayMessage', () => {
  it('includes step_complete content with preview truncation', () => {
    const long = 'x'.repeat(600)
    const msg = formatRunEventDisplayMessage({
      ...base,
      type: 'step_complete',
      message: 'implement',
      content: long,
    })
    expect(msg).toContain('step complete: implement')
    expect(msg).toContain('…')
    expect(msg?.length).toBeLessThan(long.length)
  })

  it('truncates long log messages', () => {
    const long = 'y'.repeat(600)
    const msg = formatRunEventDisplayMessage({ ...base, message: long })
    expect(msg).toBe(truncateRunEventText(long))
  })
})
