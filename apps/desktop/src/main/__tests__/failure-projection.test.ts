import type { RunEvent } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  deriveTaskFailure,
  mergeTaskFailure,
  resolveTaskFailure,
} from '../lib/projection/failure-projection.js'

const RUN_ID = 'dir-a:sess-1'

function ev(partial: Partial<RunEvent> & Pick<RunEvent, 'type' | 'at'>): RunEvent {
  return {
    runId: RUN_ID,
    runDirSlug: 'dir-a',
    sessionId: 'sess-1',
    taskId: 'task-1',
    ...partial,
  }
}

describe('deriveTaskFailure', () => {
  it('returns undefined when there are no events', () => {
    expect(deriveTaskFailure([], 'failed')).toBeUndefined()
  })

  it('extracts message and timestamp from workflow_abort', () => {
    const result = deriveTaskFailure(
      [ev({ type: 'workflow_abort', at: '2026-05-24T10:00:00.000Z', message: 'Backfill failed' })],
      'failed',
    )
    expect(result).toBeDefined()
    expect(result?.failedAt).toBe('2026-05-24T10:00:00.000Z')
    expect(result?.message).toBe('Backfill failed')
    expect(result?.kind).toBe('failed')
    expect(result?.runId).toBe(RUN_ID)
  })

  it('derives failed step from last step_start without step_complete', () => {
    const result = deriveTaskFailure(
      [
        ev({ type: 'step_start', at: '2026-05-24T10:00:00.000Z', message: 'plan' }),
        ev({ type: 'step_complete', at: '2026-05-24T10:01:00.000Z', message: 'plan' }),
        ev({ type: 'step_start', at: '2026-05-24T10:02:00.000Z', message: 'implement' }),
        ev({ type: 'workflow_abort', at: '2026-05-24T10:03:00.000Z', message: 'tests failed' }),
      ],
      'failed',
    )
    expect(result?.failedStep).toBe('implement')
  })

  it('falls back to last error log time when workflow_abort missing', () => {
    const result = deriveTaskFailure(
      [
        ev({
          type: 'log',
          at: '2026-05-24T10:00:00.000Z',
          message: 'connection lost',
          level: 'error',
        }),
      ],
      'failed',
    )
    expect(result?.failedAt).toBe('2026-05-24T10:00:00.000Z')
    expect(result?.message).toBeUndefined()
    expect(result?.recentErrorLog).toHaveLength(1)
  })

  it('caps recentErrorLog at 5 entries (latest wins)', () => {
    const events: RunEvent[] = []
    for (let i = 0; i < 8; i += 1) {
      events.push(
        ev({
          type: 'log',
          at: `2026-05-24T10:0${i}:00.000Z`,
          message: `err ${i}`,
          level: 'error',
        }),
      )
    }
    const result = deriveTaskFailure(events, 'failed')
    expect(result?.recentErrorLog).toHaveLength(5)
    expect(result?.recentErrorLog?.[0].message).toBe('err 3')
    expect(result?.recentErrorLog?.at(-1)?.message).toBe('err 7')
  })

  it('respects the exceeded kind label', () => {
    const result = deriveTaskFailure(
      [ev({ type: 'workflow_abort', at: '2026-05-24T10:00:00.000Z' })],
      'exceeded',
    )
    expect(result?.kind).toBe('exceeded')
  })
})

describe('resolveTaskFailure', () => {
  it('synthesizes minimal failure when only statusReason is present', () => {
    const result = resolveTaskFailure(
      {
        status: 'failed',
        statusReason: 'pr_failed',
        updatedAt: '2026-05-27T14:51:44.337Z',
      },
      undefined,
    )
    expect(result).toEqual({
      failedAt: '2026-05-27T14:51:44.337Z',
      kind: 'failed',
    })
  })

  it('prefers statusReason synthesis over event shell without message', () => {
    const result = resolveTaskFailure(
      {
        status: 'failed',
        statusReason: 'pr_failed',
        updatedAt: '2026-05-27T14:51:44.337Z',
      },
      {
        failedAt: '2026-05-27T14:50:00.000Z',
        kind: 'failed',
        runId: 'run-1',
      },
    )
    expect(result).toEqual({
      failedAt: '2026-05-27T14:51:44.337Z',
      kind: 'failed',
      runId: 'run-1',
    })
  })
})

describe('mergeTaskFailure', () => {
  it('prefers yaml message over run-event inference', () => {
    const fromYaml = {
      failedAt: '2026-05-27T14:51:44.337Z',
      message: 'PR creation failed: gh host unknown',
      kind: 'failed' as const,
    }
    const fromEvents = {
      failedAt: '2026-05-27T14:50:00.000Z',
      message: 'workflow_abort reason',
      kind: 'failed' as const,
      recentErrorLog: [{ at: '2026-05-27T14:50:00.000Z', level: 'error' as const, message: 'err' }],
    }
    const merged = mergeTaskFailure(fromYaml, fromEvents)
    expect(merged?.message).toBe('PR creation failed: gh host unknown')
    expect(merged?.recentErrorLog).toHaveLength(1)
  })
})
