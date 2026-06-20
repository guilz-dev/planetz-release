import { describe, expect, it } from 'vitest'
import {
  computeSpecThreadCounts,
  resolveSpecThreadPhase,
  type SpecThreadLedgerFact,
} from '../spec-thread-summary.js'

describe('computeSpecThreadCounts', () => {
  it('counts established decisions, pending, and drift', () => {
    const facts: SpecThreadLedgerFact[] = [
      { authority: 'required', ratifiedAt: '2026-06-10T00:00:00.000Z' },
      { authority: 'designed', ratifiedAt: null },
      { authority: 'ratified', ratifiedAt: '2026-06-10T00:00:00.000Z' },
      { authority: 'assumed', ratifiedAt: null },
      { authority: 'assumed', ratifiedAt: '2026-06-10T00:00:00.000Z' },
      { authority: 'observed', ratifiedAt: null, observedUnanchored: true },
      { authority: 'observed', ratifiedAt: null, observedUnanchored: false },
    ]
    const counts = computeSpecThreadCounts(facts)
    expect(counts.adrCount).toBe(3)
    // assumed(null) + observed(null) + observed(null) = 3 pending; ratified assumed excluded
    expect(counts.pendingCount).toBe(3)
    expect(counts.driftCount).toBe(1)
  })

  it('returns zeros for an empty thread', () => {
    expect(computeSpecThreadCounts([])).toEqual({ adrCount: 0, pendingCount: 0, driftCount: 0 })
  })
})

describe('resolveSpecThreadPhase', () => {
  it('prioritizes drift', () => {
    expect(resolveSpecThreadPhase({ hasDecidedIntent: true, taskCount: 2, driftCount: 1 })).toBe(
      'drift',
    )
  })

  it('reports implementing when tasks exist without drift', () => {
    expect(resolveSpecThreadPhase({ hasDecidedIntent: true, taskCount: 1, driftCount: 0 })).toBe(
      'implementing',
    )
  })

  it('reports decided when intent exists but no tasks', () => {
    expect(resolveSpecThreadPhase({ hasDecidedIntent: true, taskCount: 0, driftCount: 0 })).toBe(
      'decided',
    )
  })

  it('defaults to clarify', () => {
    expect(resolveSpecThreadPhase({ hasDecidedIntent: false, taskCount: 0, driftCount: 0 })).toBe(
      'clarify',
    )
  })
})
