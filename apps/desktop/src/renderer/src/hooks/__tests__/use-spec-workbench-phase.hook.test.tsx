import type { SpecThreadSummary } from '@planetz/shared'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSpecWorkbenchPhase } from '../use-spec-workbench-phase.js'

function summary(overrides: Partial<SpecThreadSummary> = {}): SpecThreadSummary {
  return {
    threadId: 'thread-1',
    title: 'Payment recovery',
    phase: 'clarify',
    adrCount: 0,
    pendingCount: 0,
    driftCount: 0,
    taskCount: 0,
    hasDecidedIntent: false,
    updatedAt: '2026-06-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('useSpecWorkbenchPhase', () => {
  it('defaults to clarify when no summary is active', () => {
    const { result } = renderHook(() => useSpecWorkbenchPhase(null))
    expect(result.current.workbenchPhase).toBe('clarify')
  })

  it('syncs to trace when thread phase is drift', () => {
    const { result, rerender } = renderHook(
      ({ activeSummary }) => useSpecWorkbenchPhase(activeSummary),
      { initialProps: { activeSummary: summary({ phase: 'drift', driftCount: 1 }) } },
    )
    expect(result.current.workbenchPhase).toBe('trace')

    rerender({ activeSummary: summary({ phase: 'implementing', taskCount: 1, driftCount: 0 }) })
    expect(result.current.workbenchPhase).toBe('decide')
  })

  it('keeps manual override until thread phase changes', () => {
    const activeSummary = summary({ phase: 'drift', driftCount: 1 })
    const { result, rerender } = renderHook(
      ({ activeSummary: current }) => useSpecWorkbenchPhase(current),
      { initialProps: { activeSummary } },
    )

    act(() => {
      result.current.setWorkbenchPhaseManual('clarify')
    })
    expect(result.current.workbenchPhase).toBe('clarify')

    rerender({ activeSummary: summary({ phase: 'drift', driftCount: 1 }) })
    expect(result.current.workbenchPhase).toBe('clarify')

    rerender({
      activeSummary: summary({ phase: 'implementing', taskCount: 1, driftCount: 0 }),
    })
    expect(result.current.workbenchPhase).toBe('decide')
  })

  it('resets to clarify for new spec', () => {
    const { result, rerender } = renderHook(
      ({ activeSummary }) => useSpecWorkbenchPhase(activeSummary),
      {
        initialProps: {
          activeSummary: summary({ phase: 'decided', hasDecidedIntent: true }),
        } as { activeSummary: SpecThreadSummary | null },
      },
    )

    act(() => {
      result.current.resetForNewSpec()
    })
    rerender({ activeSummary: null })

    expect(result.current.workbenchPhase).toBe('clarify')
  })
})
