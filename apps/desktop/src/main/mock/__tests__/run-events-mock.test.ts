import { beforeEach, describe, expect, it } from 'vitest'
import { resolveActiveStepFromRunEvents } from '../../lib/run-events-parser.js'
import {
  advanceMockRunSeeds,
  buildRunEvents,
  collectMockRunEvents,
  ensureMockRunSeed,
  getMockRunSeeds,
  resetMockRunSeeds,
} from '../run-events-mock.js'

describe('run-events-mock', () => {
  beforeEach(() => {
    resetMockRunSeeds()
  })

  it('emits step_start messages that match workflow step names', () => {
    const seed = getMockRunSeeds().find((s) => s.taskId === 'implement-auth-core')
    expect(seed).toBeDefined()
    const events = buildRunEvents(seed!)
    const stepStarts = events.filter((e) => e.type === 'step_start').map((e) => e.message)
    expect(stepStarts).toContain('plan')
    expect(stepStarts).toContain('implement')
    const activeStep = resolveActiveStepFromRunEvents(events, ['plan', 'implement', 'review'])
    expect(activeStep).toBe('implement')
  })

  it('advances cursor for running tasks and updates projected activeStep', () => {
    const taskId = 'implement-auth-core'
    const before = resolveActiveStepFromRunEvents(
      buildRunEvents(getMockRunSeeds().find((s) => s.taskId === taskId)!),
      ['plan', 'implement', 'review'],
    )
    expect(before).toBe('implement')

    advanceMockRunSeeds(new Set([taskId]))
    const after = resolveActiveStepFromRunEvents(
      buildRunEvents(getMockRunSeeds().find((s) => s.taskId === taskId)!),
      ['plan', 'implement', 'review'],
    )
    expect(after).toBe('review')
  })

  it('creates a dynamic seed for ad-hoc mock tasks', () => {
    ensureMockRunSeed('task-new', ['plan', 'implement', 'review'])
    const seed = getMockRunSeeds().find((s) => s.taskId === 'task-new')
    expect(seed?.steps).toEqual(['plan', 'implement', 'review'])
    expect(collectMockRunEvents().some((e) => e.taskId === 'task-new')).toBe(true)
  })
})
