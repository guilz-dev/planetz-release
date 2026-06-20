import { TASK_LIVE_ACTIVITY_CAP } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  mergeTaskLiveActivityProjection,
  projectTaskLiveActivity,
  projectTaskLiveActivityFromStepViews,
} from '../lib/projection/task-execution-activity-projection.js'
import type { RunTraceEvent } from '../lib/run-trace-types.js'

function thinkingTrace(at: string): RunTraceEvent {
  return {
    runId: 'run-1',
    runDirSlug: 'dir',
    sessionId: 'sess',
    taskId: 'task-1',
    type: 'thinking',
    at,
    text: `thought-${at}`,
  }
}

describe('projectTaskLiveActivity', () => {
  it('keeps only the most recent entries when over cap', () => {
    const traces: RunTraceEvent[] = []
    for (let i = 0; i < TASK_LIVE_ACTIVITY_CAP + 5; i++) {
      const at = `2026-05-24T10:${String(i).padStart(2, '0')}:00.000Z`
      traces.push(thinkingTrace(at))
    }
    const out = projectTaskLiveActivity(traces)
    expect(out).toHaveLength(TASK_LIVE_ACTIVITY_CAP)
    expect(out[0]?.at).toBe('2026-05-24T10:05:00.000Z')
    expect(out[out.length - 1]?.at).toBe(
      `2026-05-24T10:${String(TASK_LIVE_ACTIVITY_CAP + 4).padStart(2, '0')}:00.000Z`,
    )
  })

  it('reuses workflow step histories when trace projection is empty', () => {
    const out = projectTaskLiveActivityFromStepViews([
      {
        stepName: 'plan',
        history: [
          { at: '2026-06-02T10:00:00.000Z', kind: 'phase', text: '[phase:report] started' },
          { at: '2026-06-02T10:00:01.000Z', kind: 'message', text: 'Planner output' },
        ],
      },
    ])
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ kind: 'text', text: 'Planner output', stepName: 'plan' })
  })

  it('prefers trace projection over step views in mergeTaskLiveActivityProjection', () => {
    const traces: RunTraceEvent[] = [
      {
        runId: 'run-1',
        runDirSlug: 'dir',
        sessionId: 'sess',
        taskId: 'task-1',
        type: 'thinking',
        at: '2026-06-02T10:00:00.000Z',
        text: 'from trace',
      },
    ]
    const merged = mergeTaskLiveActivityProjection(traces, [
      {
        stepName: 'plan',
        history: [{ at: '2026-06-02T10:00:01.000Z', kind: 'message', text: 'from step' }],
      },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.text).toBe('from trace')
  })
})
