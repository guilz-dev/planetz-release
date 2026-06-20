import {
  completedStageIndex,
  isTraceAffordanceMuted,
  type SpecThreadPhase,
  type SpecWorkbenchPhase,
  workbenchPhaseToStageIndex,
} from '@planetz/shared'
import { cn } from '../ui/cn'

const STAGES: SpecWorkbenchPhase[] = ['clarify', 'decide', 'trace']

export interface SpecPhaseStepperLabels {
  clarify: string
  decide: string
  trace: string
  stepNumbers: [string, string, string]
  traceDisabledHint: string
}

export interface SpecPhaseStepperProps {
  workbenchPhase: SpecWorkbenchPhase
  threadPhase: SpecThreadPhase | null
  taskCount: number
  driftCount: number
  labels: SpecPhaseStepperLabels
  onSelectPhase: (phase: SpecWorkbenchPhase) => void
}

export function SpecPhaseStepper({
  workbenchPhase,
  threadPhase,
  taskCount,
  driftCount,
  labels,
  onSelectPhase,
}: SpecPhaseStepperProps) {
  const progress = threadPhase ? completedStageIndex(threadPhase) : 0
  const currentIndex = workbenchPhaseToStageIndex(workbenchPhase)
  const stageLabels = [labels.clarify, labels.decide, labels.trace] as const

  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Spec workbench phases">
      {STAGES.map((phase, index) => {
        const isCurrent = index === currentIndex
        const isCompleted = index < progress
        const isTrace = phase === 'trace'
        const traceMuted = isTrace && isTraceAffordanceMuted(taskCount)
        const traceBadge =
          isTrace && driftCount > 0
            ? `⚠ ${driftCount}`
            : isTrace && taskCount > 0
              ? String(taskCount)
              : null

        return (
          <div key={phase} className="flex items-center gap-1">
            {index > 0 ? (
              <span
                className={cn(
                  'h-px w-4',
                  isCompleted ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
                )}
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              title={traceMuted ? labels.traceDisabledHint : undefined}
              onClick={() => onSelectPhase(phase)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-center transition-colors',
                isCurrent
                  ? 'bg-[var(--color-panel-strong)] text-[var(--color-text-strong)]'
                  : traceMuted
                    ? 'text-[var(--color-muted)]/60 hover:text-[var(--color-muted)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
              )}
            >
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    'inline-block size-2 rounded-full',
                    isCurrent
                      ? 'bg-[var(--color-accent)]'
                      : isCompleted
                        ? 'bg-[var(--color-accent)]/70'
                        : 'border border-[var(--color-border)] bg-transparent',
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold tabular-nums">
                  {labels.stepNumbers[index]}
                </span>
                {traceBadge ? (
                  <span
                    className={cn(
                      'rounded-full px-1 py-px text-[9px] font-semibold',
                      driftCount > 0
                        ? 'bg-[var(--color-status-exceeded-soft)] text-[var(--color-status-exceeded)]'
                        : 'bg-[var(--color-panel-strong)] text-[var(--color-muted-strong)]',
                    )}
                  >
                    {traceBadge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-[5.5rem] truncate text-[10px] font-medium leading-tight">
                {stageLabels[index]}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
