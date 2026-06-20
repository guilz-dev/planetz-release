import { describe, expect, it } from 'vitest'
import {
  traceToStepActivityEntry,
  traceToTaskExecutionEntry,
} from '../lib/projection/trace-event-to-activity.js'
import type { RunTraceEvent } from '../lib/run-trace-types.js'

const base: Omit<RunTraceEvent, 'type' | 'at'> = {
  runId: 'run:sess',
  runDirSlug: 'run',
  sessionId: 'sess',
  taskId: 't1',
}

describe('trace-event-to-activity', () => {
  it('maps tool_use to consistent task and step entries', () => {
    const ev: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:00.000Z',
      type: 'tool_use',
      toolName: 'grep',
      stepName: 'implement',
    }
    const task = traceToTaskExecutionEntry(ev)
    const step = traceToStepActivityEntry(ev)
    expect(task?.kind).toBe('tool_use')
    expect(task?.text).toContain('grep')
    expect(step?.kind).toBe('tool_use')
    expect(step?.text).toBe(task?.text)
  })

  it('maps assistant_error and rate_limit to task activity kinds', () => {
    const err: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:02.000Z',
      type: 'assistant_error',
      text: 'provider failed',
      level: 'error',
    }
    const limit: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:03.000Z',
      type: 'rate_limit',
      text: 'slow down',
      level: 'warn',
    }
    expect(traceToTaskExecutionEntry(err)).toMatchObject({
      kind: 'error',
      level: 'error',
      text: 'provider failed',
    })
    expect(traceToTaskExecutionEntry(limit)).toMatchObject({
      kind: 'status',
      level: 'warn',
      text: 'slow down',
    })
  })

  it('preserves phase-complete payload content in phase activity entries', () => {
    const start: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:04.000Z',
      type: 'phase_start',
      phaseName: 'execute',
    }
    const complete: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:05.000Z',
      type: 'phase_complete',
      phaseName: 'execute',
      content: 'Planner output for tests',
    }
    expect(traceToTaskExecutionEntry(start)).toMatchObject({
      kind: 'phase',
      text: '[phase:execute] started',
    })
    expect(traceToTaskExecutionEntry(complete)).toMatchObject({
      kind: 'phase',
      text: '[phase:execute] Planner output for tests',
    })
  })

  it('truncates long tool_output previews', () => {
    const long = 'x'.repeat(600)
    const ev: RunTraceEvent = {
      ...base,
      at: '2026-06-02T10:00:01.000Z',
      type: 'tool_output',
      text: long,
    }
    const entry = traceToTaskExecutionEntry(ev)
    expect(entry?.text.length).toBeLessThan(long.length)
    expect(entry?.text.endsWith('…')).toBe(true)
  })
})
