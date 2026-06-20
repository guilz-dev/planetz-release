import { deriveActivityState, type TaskViewModel } from '@planetz/shared'
import { useMemo } from 'react'
import { useTickingNow } from '../hooks/use-ticking-now'
import { useI18n } from '../i18n'
import { resolveTaskLiveActivityFeed } from '../lib/resolve-task-live-activity-feed'
import { LiveActivityLog } from './live-activity-log'
import { Badge } from './ui/badge'
import { cn } from './ui/cn'

interface TaskExecutionStatusPanelProps {
  task: TaskViewModel
  className?: string
}

const ACTIVITY_BADGE_TONE: Record<
  ReturnType<typeof deriveActivityState>,
  'running' | 'neutral' | 'exceeded' | 'pending'
> = {
  active: 'running',
  quiet: 'neutral',
  stale: 'exceeded',
  unknown: 'pending',
}

export function TaskExecutionStatusPanel({ task, className }: TaskExecutionStatusPanelProps) {
  const { t } = useI18n()
  const now = useTickingNow(1_000, true)
  const status = task.executionStatus
  const activityState = deriveActivityState(status?.lastEventAt, now)
  const activityLabel = t(`panels.running.executionStatus.activity.${activityState}`)
  const feed = useMemo(() => resolveTaskLiveActivityFeed(task), [task])

  const runId = status?.runId ?? task.activeRunId

  return (
    <section
      aria-label={t('panels.running.executionStatus.aria')}
      className={cn(
        'flex flex-col gap-2 rounded-md border border-[var(--color-status-running)]/30 bg-[var(--color-status-running-soft)]/30 p-2.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ACTIVITY_BADGE_TONE[activityState]}>{activityLabel}</Badge>
        {runId ? (
          <span
            className="max-w-full truncate font-mono text-[10px] text-[var(--color-muted)]"
            title={runId}
          >
            {t('panels.running.runId', { runId })}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
        {status?.workflowStep ? (
          <>
            <dt className="text-[var(--color-muted)]">
              {t('panels.running.executionStatus.workflowStep')}
            </dt>
            <dd className="font-mono text-[var(--color-text)]">{status.workflowStep}</dd>
          </>
        ) : null}
        {status?.innerStep && status.innerStep !== status.workflowStep ? (
          <>
            <dt className="text-[var(--color-muted)]">
              {t('panels.running.executionStatus.innerStep')}
            </dt>
            <dd className="font-mono text-[var(--color-text)]">{status.innerStep}</dd>
          </>
        ) : null}
        {status?.phase ? (
          <>
            <dt className="text-[var(--color-muted)]">
              {t('panels.running.executionStatus.phase')}
            </dt>
            <dd className="font-mono text-[var(--color-text)]">{status.phase}</dd>
          </>
        ) : null}
      </dl>

      {status?.lastEventSummary && feed.length === 0 ? (
        <p className="font-mono text-[11px] leading-snug text-[var(--color-text)]">
          {status.lastEventSummary}
        </p>
      ) : feed.length === 0 ? (
        <p className="text-[11px] italic text-[var(--color-muted)]">
          {t('panels.running.liveWaitingEvents')}
        </p>
      ) : null}

      {feed.length > 0 ? <LiveActivityLog entries={feed} /> : null}
    </section>
  )
}
