import type { WorkflowStepActivityView, WorkflowSummary } from '@planetz/shared'
import { Check, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { resolveWorkflowStepIndex } from '../lib/task-execution-display'
import { StepActivityLog } from './step-activity-log'
import { cn } from './ui/cn'

interface WorkflowStepListProps {
  workflow?: WorkflowSummary
  activeStep?: string
  /** True when the task whose workflow we're showing is actually running. */
  live?: boolean
  stepActivities?: WorkflowStepActivityView[]
}

type StepState = 'past' | 'active' | 'future'

export function WorkflowStepList({
  workflow,
  activeStep,
  live,
  stepActivities,
}: WorkflowStepListProps) {
  const { t } = useI18n()

  const activityByStep = useMemo(() => {
    const map = new Map<string, WorkflowStepActivityView>()
    for (const a of stepActivities ?? []) {
      map.set(a.stepName, a)
    }
    return map
  }, [stepActivities])

  const personaByStep = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of workflow?.steps ?? []) {
      if (s.persona) map.set(s.name, s.persona)
    }
    return map
  }, [workflow?.steps])

  if (!workflow) {
    return <p className="text-xs text-[var(--color-muted)]">{t('panels.running.noWorkflow')}</p>
  }

  const steps = workflow.stepNames
  const activeIdx = resolveWorkflowStepIndex(workflow, activeStep)
  const stepLive = (live ?? false) && activeIdx >= 0

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-[var(--color-muted)]">
        {t('panels.running.workflowLabel')}{' '}
        <span className="font-mono text-[var(--color-text)]">{workflow.name}</span>{' '}
        <span className="text-[var(--color-muted)]/70">({workflow.source})</span>
      </p>
      <ol className="flex flex-col gap-1" aria-label={t('panels.running.stepsAria')}>
        {steps.map((step, i) => {
          const state = resolveStepState(activeIdx, i)
          const activity = activityByStep.get(step)
          const persona = personaByStep.get(step)
          return (
            <li
              key={step}
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm',
                state === 'active' &&
                  'bg-[var(--color-accent-soft)]/60 ring-1 ring-inset ring-[var(--color-accent)]/30',
              )}
            >
              <div className="flex items-center gap-2.5">
                <StepCircle state={state} index={i} live={stepLive} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-mono text-[12px] leading-tight',
                    state === 'past' && 'font-medium text-[var(--color-text-strong)]',
                    state === 'active' && 'font-semibold text-[var(--color-text-strong)]',
                    state === 'future' && 'text-[var(--color-muted)]',
                  )}
                  title={step}
                >
                  {step}
                </span>
                {persona ? (
                  <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
                    {persona}
                  </span>
                ) : null}
              </div>
              <StepActivityLog
                state={state}
                latest={activity?.latest}
                history={activity?.history}
                summary={activity?.summary}
                completedAt={activity?.completedAt}
                durationSec={activity?.durationSec}
                autoExpandLive={stepLive && state === 'active'}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function resolveStepState(activeIdx: number, i: number): StepState {
  if (activeIdx < 0) return 'future'
  if (i < activeIdx) return 'past'
  if (i === activeIdx) return 'active'
  return 'future'
}

function StepCircle({ state, index, live }: { state: StepState; index: number; live: boolean }) {
  if (state === 'past') {
    return (
      <span
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-completed-soft)]"
        aria-hidden="true"
      >
        <Check size={11} strokeWidth={3} className="text-[var(--color-status-completed)]" />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)]"
        aria-hidden="true"
      >
        {live ? (
          <Loader2
            size={20}
            strokeWidth={2}
            className="absolute inset-0 animate-spin text-[var(--color-accent)] motion-reduce:animate-none"
          />
        ) : (
          <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-[var(--color-accent)]/40" />
        )}
        <span className="relative text-[10px] font-semibold text-[var(--color-text-strong)]">
          {index + 1}
        </span>
      </span>
    )
  }
  return (
    <span
      className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)]"
      aria-hidden="true"
    >
      <span className="text-[10px] text-[var(--color-muted)]">{index + 1}</span>
    </span>
  )
}
