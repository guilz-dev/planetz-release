import type { SpecThreadPhase } from './spec-thread-summary.js'

/** Workbench mode selected in Spec Studio center pane. */
export type SpecWorkbenchPhase = 'clarify' | 'decide' | 'trace'

export function mapThreadPhaseToWorkbenchPhase(phase: SpecThreadPhase): SpecWorkbenchPhase {
  if (phase === 'drift') return 'trace'
  if (phase === 'decided' || phase === 'implementing') return 'decide'
  return 'clarify'
}

/** Data-progress on the stepper (0 = clarify only, 2 = trace reachable). */
export function completedStageIndex(threadPhase: SpecThreadPhase): number {
  if (threadPhase === 'drift') return 2
  if (threadPhase === 'implementing') return 1
  if (threadPhase === 'decided') return 1
  return 0
}

export function workbenchPhaseToStageIndex(phase: SpecWorkbenchPhase): number {
  if (phase === 'trace') return 2
  if (phase === 'decide') return 1
  return 0
}

/** Trace step is muted until at least one implementation task is linked. */
export function isTraceAffordanceMuted(taskCount: number): boolean {
  return taskCount === 0
}

export interface WorkbenchPhaseOverride {
  phase: SpecWorkbenchPhase
  threadPhaseAtOverride: SpecThreadPhase
}

/** Applies per-thread manual override when thread phase has not changed. */
export function resolveWorkbenchPhase(
  summary: { phase: SpecThreadPhase } | null,
  override: WorkbenchPhaseOverride | undefined,
): SpecWorkbenchPhase {
  if (!summary) return 'clarify'
  if (override && override.threadPhaseAtOverride === summary.phase) {
    return override.phase
  }
  return mapThreadPhaseToWorkbenchPhase(summary.phase)
}
