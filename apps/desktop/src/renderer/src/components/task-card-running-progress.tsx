import type { ExecutorState, TaskViewModel, WorkflowSummary } from '@planetz/shared'
import { Sparkles, Timer } from 'lucide-react'
import { Fragment } from 'react'
import { useI18n } from '../i18n'
import { formatElapsed } from '../lib/format-elapsed'
import {
  describeWorkflowProgress,
  resolveExecutorDisplay,
  resolveWorkflowStepIndex,
} from '../lib/task-execution-display'
import { MantaProgressHead } from '../skins/manta/manta-progress-head'
import { cn } from './ui/cn'

/** Switch the mini progress tracker representation when the workflow has many steps. */
const MINI_BAR_THRESHOLD = 5

export interface TaskCardRunningProgressProps {
  task: TaskViewModel
  workflow: WorkflowSummary | undefined
  executors: ExecutorState[] | undefined
  now: number | undefined
}

export function TaskCardRunningProgress({
  task,
  workflow,
  executors,
  now,
}: TaskCardRunningProgressProps) {
  const { t } = useI18n()
  const steps = workflow?.stepNames ?? []
  const activeIdx = resolveWorkflowStepIndex(workflow, task.activeStep)
  const useBar = steps.length >= MINI_BAR_THRESHOLD
  const elapsedMs = now != null ? now - Date.parse(task.updatedAt) : null
  const { label: executorLabel } = resolveExecutorDisplay(task, executors)
  const latestActivity = resolveLatestActivityText(task)

  return (
    <>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
        {steps.length > 0 ? (
          useBar ? (
            <MiniProgressBar steps={steps} activeIdx={activeIdx} />
          ) : (
            <MiniStepTracker steps={steps} activeIdx={activeIdx} />
          )
        ) : null}
        <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          {elapsedMs != null ? (
            <span
              className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--color-text)]"
              title={t('panels.running.elapsedAria')}
            >
              <Timer size={10} className="text-[var(--color-status-running)]" />
              {formatElapsed(elapsedMs)}
            </span>
          ) : null}
          {task.activeStep ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-[var(--color-muted)]">{t('panels.running.onStep')}</span>
              <span className="font-mono text-[var(--color-text)]">{task.activeStep}</span>
            </span>
          ) : (
            <span className="text-[var(--color-muted)]">{t('panels.running.stepUnknown')}</span>
          )}
          {executorLabel ? (
            <span
              className="inline-flex items-center gap-1 text-[var(--color-muted-strong)]"
              title={executorLabel}
            >
              <Sparkles size={10} className="text-[var(--color-accent)]" />
              <span className="font-medium text-[var(--color-text)]">{executorLabel}</span>
            </span>
          ) : null}
        </span>
      </div>
      {latestActivity ? (
        <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-muted)]">
          <span className="text-[var(--color-muted)]">↳ </span>
          {latestActivity}
        </p>
      ) : null}
    </>
  )
}

function resolveLatestActivityText(task: TaskViewModel): string | undefined {
  const activities = task.workflowStepActivities
  if (!activities?.length) return undefined
  const activeName = task.activeStep
  if (activeName) {
    return activities.find((a) => a.stepName === activeName)?.latest?.text
  }
  return activities.find((a) => a.latest)?.latest?.text
}

/**
 * Orbit progress track (design §5.1). Steps are nodes on an orbital track:
 * completed = solid (green), current = a small manta with one planet orbiting
 * it, future = hollow ring. Shape (solid / manta / hollow) carries the state in
 * addition to color, so it reads without color too (§8). Motion is confined to
 * the current node.
 */
function MiniStepTracker({ steps, activeIdx }: { steps: string[]; activeIdx: number }) {
  const label = describeWorkflowProgress(steps, activeIdx)
  return (
    <span className="inline-flex shrink-0 items-center" title={label}>
      {steps.map((step, i) => {
        const past = activeIdx >= 0 && i < activeIdx
        const active = activeIdx >= 0 && i === activeIdx
        return (
          <Fragment key={step}>
            {active ? (
              <MantaProgressHead size={11} />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block rounded-full',
                  past
                    ? 'h-2 w-2 bg-[var(--color-status-completed)]'
                    : 'h-2 w-2 border border-[var(--color-border-strong)] bg-transparent',
                )}
              />
            )}
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-0.5 inline-block h-px w-2',
                  past ? 'bg-[var(--color-status-completed)]/60' : 'bg-[var(--color-border)]',
                )}
              />
            ) : null}
          </Fragment>
        )
      })}
    </span>
  )
}

function MiniProgressBar({ steps, activeIdx }: { steps: string[]; activeIdx: number }) {
  const total = steps.length
  const completed = activeIdx < 0 ? 0 : activeIdx
  const filledPct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const label = describeWorkflowProgress(steps, activeIdx)
  return (
    <span className="inline-flex w-24 shrink-0 items-center gap-1.5" title={label}>
      {/* Orbit track: a manta rides the fill position instead of a plain head. */}
      <span aria-hidden="true" className="relative h-3 flex-1">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--color-border)]">
          <span
            className="absolute inset-y-0 left-0 bg-[var(--color-status-completed)]/70"
            style={{ width: `${filledPct}%` }}
          />
        </span>
        {activeIdx >= 0 ? (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${filledPct}%` }}
          >
            <MantaProgressHead size={9} />
          </span>
        ) : null}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--color-muted-strong)]">
        {completed}/{total}
      </span>
    </span>
  )
}
