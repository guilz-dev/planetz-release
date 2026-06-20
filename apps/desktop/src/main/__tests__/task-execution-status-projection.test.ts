import { describe, expect, it } from 'vitest'
import { projectTaskExecutionStatus } from '../lib/projection/task-execution-status-projection.js'
import type { RunTraceEvent } from '../lib/run-trace-types.js'

const base: Omit<RunTraceEvent, 'type' | 'at'> = {
  runId: 'run:sess',
  runDirSlug: 'run',
  sessionId: 'sess',
  taskId: 't1',
}

describe('projectTaskExecutionStatus', () => {
  it('returns undefined when there is no highlight context and no live activity', () => {
    expect(
      projectTaskExecutionStatus([], { activeRunId: undefined, activeStep: undefined }, []),
    ).toBeUndefined()
  })

  it('derives innerStep, phase, and last event from traces and live activity', () => {
    const traces: RunTraceEvent[] = [
      {
        ...base,
        at: '2026-06-02T10:00:00.000Z',
        type: 'phase_start',
        phaseName: 'execute',
        stepName: 'implement',
      },
      {
        ...base,
        at: '2026-06-02T10:00:01.000Z',
        type: 'thinking',
        text: 'Considering options',
        stepName: 'write_tests',
      },
    ]
    const liveActivity = [
      {
        at: '2026-06-02T10:00:01.000Z',
        kind: 'thinking' as const,
        text: 'Considering options',
      },
    ]
    const status = projectTaskExecutionStatus(
      traces,
      { activeRunId: 'run:sess', activeStep: 'implement' },
      liveActivity,
    )
    expect(status).toMatchObject({
      runId: 'run:sess',
      workflowStep: 'implement',
      innerStep: 'write_tests',
      phase: 'execute',
      lastEventAt: '2026-06-02T10:00:01.000Z',
      lastEventSummary: 'Considering options',
    })
  })

  it('keeps workflowStep from context when traces only carry inner step hints', () => {
    const traces: RunTraceEvent[] = [
      {
        ...base,
        at: '2026-06-02T10:00:00.000Z',
        type: 'tool_use',
        toolName: 'Read',
        stepName: 'nested',
      },
    ]
    const status = projectTaskExecutionStatus(
      traces,
      { activeRunId: undefined, activeStep: 'plan' },
      [],
    )
    expect(status?.workflowStep).toBe('plan')
    expect(status?.innerStep).toBe('nested')
  })
})
