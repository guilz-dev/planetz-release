import { describe, expect, it } from 'vitest'
import {
  completedStageIndex,
  isTraceAffordanceMuted,
  mapThreadPhaseToWorkbenchPhase,
  resolveWorkbenchPhase,
  workbenchPhaseToStageIndex,
} from '../spec-workbench-phase.js'

describe('mapThreadPhaseToWorkbenchPhase', () => {
  it('maps thread phases to default workbench modes', () => {
    expect(mapThreadPhaseToWorkbenchPhase('clarify')).toBe('clarify')
    expect(mapThreadPhaseToWorkbenchPhase('decided')).toBe('decide')
    expect(mapThreadPhaseToWorkbenchPhase('implementing')).toBe('decide')
    expect(mapThreadPhaseToWorkbenchPhase('drift')).toBe('trace')
  })
})

describe('completedStageIndex', () => {
  it('reflects data progress on the stepper', () => {
    expect(completedStageIndex('clarify')).toBe(0)
    expect(completedStageIndex('decided')).toBe(1)
    expect(completedStageIndex('implementing')).toBe(1)
    expect(completedStageIndex('drift')).toBe(2)
  })
})

describe('workbenchPhaseToStageIndex', () => {
  it('maps workbench modes to stepper indices', () => {
    expect(workbenchPhaseToStageIndex('clarify')).toBe(0)
    expect(workbenchPhaseToStageIndex('decide')).toBe(1)
    expect(workbenchPhaseToStageIndex('trace')).toBe(2)
  })
})

describe('isTraceAffordanceMuted', () => {
  it('is muted until implementation tasks are linked', () => {
    expect(isTraceAffordanceMuted(0)).toBe(true)
    expect(isTraceAffordanceMuted(1)).toBe(false)
  })
})

describe('resolveWorkbenchPhase', () => {
  it('falls back to clarify when summary is missing', () => {
    expect(resolveWorkbenchPhase(null, undefined)).toBe('clarify')
  })

  it('honors override while thread phase is unchanged', () => {
    expect(
      resolveWorkbenchPhase(
        { phase: 'drift' },
        { phase: 'clarify', threadPhaseAtOverride: 'drift' },
      ),
    ).toBe('clarify')
  })

  it('drops stale override when thread phase changed', () => {
    expect(
      resolveWorkbenchPhase(
        { phase: 'implementing' },
        { phase: 'trace', threadPhaseAtOverride: 'drift' },
      ),
    ).toBe('decide')
  })
})
