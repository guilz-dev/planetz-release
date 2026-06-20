import { describe, expect, it } from 'vitest'
import {
  stepActivityKindToTaskExecutionKind,
  stepActivityToTaskExecutionEntry,
} from '../step-activity-to-task-activity.js'

describe('stepActivityToTaskExecutionEntry', () => {
  it('maps message kind to text for task-level live feed', () => {
    const entry = stepActivityToTaskExecutionEntry(
      { at: '2026-06-02T10:00:00.000Z', kind: 'message', text: 'Planner output' },
      'plan',
    )
    expect(entry.kind).toBe('text')
    expect(entry.stepName).toBe('plan')
  })

  it('maps legacy step kinds to status', () => {
    expect(stepActivityKindToTaskExecutionKind('log')).toBe('status')
    expect(stepActivityKindToTaskExecutionKind('read')).toBe('status')
  })
})
