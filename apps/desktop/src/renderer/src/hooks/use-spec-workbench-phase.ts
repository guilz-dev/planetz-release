import type { SpecThreadSummary, SpecWorkbenchPhase } from '@planetz/shared'
import { resolveWorkbenchPhase, type WorkbenchPhaseOverride } from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpecWorkbenchPhase(activeSummary: SpecThreadSummary | null) {
  const [workbenchPhase, setWorkbenchPhase] = useState<SpecWorkbenchPhase>('clarify')
  const overridesRef = useRef(new Map<string, WorkbenchPhaseOverride>())

  const syncFromSummary = useCallback((summary: SpecThreadSummary | null) => {
    const override = summary ? overridesRef.current.get(summary.threadId) : undefined
    setWorkbenchPhase(resolveWorkbenchPhase(summary, override))
    if (summary && override && override.threadPhaseAtOverride !== summary.phase) {
      overridesRef.current.delete(summary.threadId)
    }
  }, [])

  useEffect(() => {
    syncFromSummary(activeSummary)
  }, [activeSummary, syncFromSummary])

  const setWorkbenchPhaseManual = useCallback(
    (phase: SpecWorkbenchPhase) => {
      setWorkbenchPhase(phase)
      if (!activeSummary) return
      overridesRef.current.set(activeSummary.threadId, {
        phase,
        threadPhaseAtOverride: activeSummary.phase,
      })
    },
    [activeSummary],
  )

  const resetForNewSpec = useCallback(() => {
    setWorkbenchPhase('clarify')
  }, [])

  return {
    workbenchPhase,
    setWorkbenchPhaseManual,
    resetForNewSpec,
  }
}
