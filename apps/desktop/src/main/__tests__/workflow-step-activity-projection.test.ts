import { formatRunId } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  projectWorkflowStepActivities,
  WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT,
} from '../lib/projection/workflow-step-activity-projection.js'
import type { RunTraceEvent } from '../lib/run-trace-types.js'

const RUN = formatRunId('run-dir', 'sess-1')
const STEPS = ['plan', 'implement', 'review'] as const

function traceEv(
  partial: Pick<RunTraceEvent, 'type' | 'at' | 'text' | 'stepName' | 'content'>,
): RunTraceEvent {
  return {
    runId: RUN,
    runDirSlug: 'run-dir',
    sessionId: 'sess-1',
    taskId: 'task-1',
    ...partial,
  }
}

describe('projectWorkflowStepActivities', () => {
  it('groups inner-step events under the current top-level workflow step', () => {
    const traces: RunTraceEvent[] = [
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_complete',
        at: '2026-05-27T10:01:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:01:01.000Z',
        stepName: 'implement',
        text: 'implement',
      }),
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:01:10.000Z',
        stepName: 'write_tests',
        text: 'write_tests',
      }),
      traceEv({
        type: 'text',
        at: '2026-05-27T10:02:00.000Z',
        text: 'read src/auth/session.ts',
        stepName: 'write_tests',
      }),
    ]
    const activities = projectWorkflowStepActivities(traces, [...STEPS], RUN)
    const plan = activities.find((a) => a.stepName === 'plan')
    const implement = activities.find((a) => a.stepName === 'implement')
    expect(plan?.history.length).toBeGreaterThanOrEqual(2)
    expect(implement?.history.some((e) => e.text.includes('read'))).toBe(true)
    expect(implement?.latest?.text).toContain('read')
  })

  it('captures completion timing for past steps without hardcoded summary copy', () => {
    const traces: RunTraceEvent[] = [
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_complete',
        at: '2026-05-27T10:01:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:01:01.000Z',
        stepName: 'implement',
        text: 'implement',
      }),
    ]
    const activities = projectWorkflowStepActivities(traces, [...STEPS], RUN)
    expect(activities.find((a) => a.stepName === 'plan')).toMatchObject({
      completedAt: '2026-05-27T10:01:00.000Z',
      durationSec: 60,
    })
  })

  it('routes provider-events step hint to the matching top-level step', () => {
    const traces: RunTraceEvent[] = [
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_complete',
        at: '2026-05-27T10:01:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:01:01.000Z',
        stepName: 'implement',
        text: 'implement',
      }),
      traceEv({
        type: 'thinking',
        at: '2026-05-27T10:02:00.000Z',
        text: 'Considering test strategy…',
        stepName: 'write_tests',
      }),
    ]
    const activities = projectWorkflowStepActivities(traces, [...STEPS], RUN)
    const implement = activities.find((a) => a.stepName === 'implement')
    expect(implement?.history.some((e) => e.kind === 'thinking')).toBe(true)
  })

  it('caps history length per step', () => {
    const traces: RunTraceEvent[] = [
      traceEv({
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        stepName: 'plan',
        text: 'plan',
      }),
    ]
    for (let i = 0; i < WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT + 5; i += 1) {
      traces.push(
        traceEv({
          type: 'text',
          at: `2026-05-27T10:00:${String(i).padStart(2, '0')}.000Z`,
          text: `event ${i}`,
          stepName: 'plan',
        }),
      )
    }
    const activities = projectWorkflowStepActivities(traces, [...STEPS], RUN)
    const plan = activities.find((a) => a.stepName === 'plan')
    expect(plan?.history.length).toBe(WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT)
  })
})
