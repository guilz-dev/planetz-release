import type { RunEvent } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  assignStableLogRecordIds,
  decodeLogCursor,
  encodeLogCursor,
  isLogRecordBeforeCursor,
  stableLogRecordBaseId,
  stableLogRecordId,
} from '../planetz/execution-log-cursor.js'

describe('execution-log-cursor', () => {
  it('round-trips cursor payload', () => {
    const payload = { at: '2026-01-01T00:00:00.000Z', id: 'run:s:step_start' }
    const encoded = encodeLogCursor(payload)
    expect(decodeLogCursor(encoded)).toEqual(payload)
  })

  it('rejects invalid cursor', () => {
    expect(() => decodeLogCursor('not-valid')).toThrow('Invalid execution log cursor')
  })

  it('stableLogRecordId matches service format', () => {
    expect(
      stableLogRecordId({
        runId: 'run-a:session-1',
        at: '2026-01-01T00:00:00.000Z',
        eventType: 'log',
      }),
    ).toBe('run-a:session-1:2026-01-01T00:00:00.000Z:log')
  })

  it('assignStableLogRecordIds suffixes duplicate base keys', () => {
    const at = '2026-01-01T00:00:00.000Z'
    const base = stableLogRecordBaseId({
      runId: 'run-a:session-1',
      at,
      eventType: 'log',
    })
    const events: RunEvent[] = [
      {
        runId: 'run-a:session-1',
        runDirSlug: 'run-a',
        sessionId: 'session-1',
        type: 'log',
        at,
        message: 'first',
        level: 'info',
      },
      {
        runId: 'run-a:session-1',
        runDirSlug: 'run-a',
        sessionId: 'session-1',
        type: 'log',
        at,
        message: 'second',
        level: 'info',
      },
    ]
    expect(assignStableLogRecordIds(events)).toEqual([base, `${base}~1`])
  })

  it('isLogRecordBeforeCursor respects descending order', () => {
    const cursor = { at: '2026-01-02T00:00:00.000Z', id: 'b' }
    expect(isLogRecordBeforeCursor({ at: '2026-01-01T00:00:00.000Z', id: 'a' }, cursor)).toBe(true)
    expect(isLogRecordBeforeCursor({ at: '2026-01-02T00:00:00.000Z', id: 'c' }, cursor)).toBe(false)
  })
})
