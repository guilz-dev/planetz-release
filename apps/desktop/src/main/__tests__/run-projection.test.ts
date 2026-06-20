import { formatRunId, type RunEvent } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  indexRunEventsByTaskId,
  lastRunIdFromTaskEvents,
  projectTaskRunHighlight,
  resolveActiveRunIdForTask,
} from '../lib/projection/run-projection.js'

describe('indexRunEventsByTaskId', () => {
  it('sorts each task bucket by at so lastRunId is chronologically correct', () => {
    const runA = formatRunId('dir', 'a')
    const runB = formatRunId('dir', 'b')
    const unsorted: RunEvent[] = [
      {
        runId: runB,
        runDirSlug: 'dir',
        sessionId: 'b',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-24T12:00:00.000Z',
        message: 'implement',
      },
      {
        runId: runA,
        runDirSlug: 'dir',
        sessionId: 'a',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-24T09:00:00.000Z',
        message: 'plan',
      },
    ]
    const bucket = indexRunEventsByTaskId(unsorted).get('t1') ?? []
    expect(lastRunIdFromTaskEvents(bucket)).toBe(runB)
  })
})

describe('resolveActiveRunIdForTask', () => {
  it('ignores pinned runId when no events exist for that run', () => {
    const runB = formatRunId('dir', 'b')
    const byTask: RunEvent[] = [
      {
        runId: runB,
        runDirSlug: 'dir',
        sessionId: 'b',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-24T11:00:00.000Z',
        message: 'implement',
      },
    ]
    expect(resolveActiveRunIdForTask(byTask, 'ghost:missing')).toBe(runB)
  })
})

describe('projectTaskRunHighlight', () => {
  it('derives next step after step_complete within a run', () => {
    const runId = formatRunId('dir', 's1')
    const byTask: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir',
        sessionId: 's1',
        taskId: 't1',
        type: 'step_complete',
        at: '2026-05-24T10:00:00.000Z',
        message: 'plan',
      },
    ]
    const { activeStep, activeRunId } = projectTaskRunHighlight(byTask, undefined, [
      'plan',
      'implement',
      'review',
    ])
    expect(activeRunId).toBe(runId)
    expect(activeStep).toBe('implement')
  })
})
