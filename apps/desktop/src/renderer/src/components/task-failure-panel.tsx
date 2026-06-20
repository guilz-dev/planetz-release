import type { TaskFailure, TaskViewModel } from '@planetz/shared'
import { AlertOctagon, ExternalLink, RefreshCcw, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTickingNow } from '../hooks/use-ticking-now'
import { useI18n } from '../i18n'
import { formatElapsed } from '../lib/format-elapsed'
import { taskStatusReasonI18nKey } from '../lib/task-status-reason-label'
import type { RetryAction } from './retry-action-dialog'
import { Button } from './ui/button'
import { cn } from './ui/cn'

interface TaskFailurePanelProps {
  task: TaskViewModel
  failure: TaskFailure
  onRequestRetryAction?: (action: RetryAction, task: TaskViewModel) => void
  onOpenExecutionLog?: (task: TaskViewModel) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function TaskFailurePanel({
  task,
  failure,
  onRequestRetryAction,
  onOpenExecutionLog,
}: TaskFailurePanelProps) {
  const { t } = useI18n()
  const now = useTickingNow(30_000, true)
  const failedMs = Date.parse(failure.failedAt)
  const elapsed = Number.isNaN(failedMs)
    ? null
    : t('panels.failure.elapsed', { value: formatElapsed(Math.max(0, now - failedMs)) })
  const reasonKey = taskStatusReasonI18nKey(task.statusReason)
  const reasonSuffix = reasonKey
    ? task.statusReason === 'unknown_status'
      ? t(reasonKey, { raw: task.rawStatus ?? '?' })
      : t(reasonKey)
    : null
  const baseHeading =
    failure.kind === 'exceeded' ? t('panels.failure.headingExceeded') : t('panels.failure.heading')
  const heading = reasonSuffix ? `${baseHeading} · ${reasonSuffix}` : baseHeading
  const headingId = `failure-heading-${task.id}`
  const reasonId = `failure-reason-${task.id}`

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-3 rounded-md border p-3',
        'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/50',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2 text-[var(--color-status-failed)]">
          <AlertOctagon size={14} className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id={headingId} className="text-sm font-semibold leading-snug">
              {heading}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <span className="font-mono text-xs text-[var(--color-status-failed)]/90">
                {formatTime(failure.failedAt)}
              </span>
              {elapsed ? (
                <span className="text-xs text-[var(--color-muted-strong)]">({elapsed})</span>
              ) : null}
            </div>
          </div>
        </div>
        {onOpenExecutionLog ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leading={<ExternalLink size={11} />}
            onClick={() => onOpenExecutionLog(task)}
          >
            {t('panels.failure.openLog')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
            {t('panels.failure.stepHeading')}
          </span>
          {failure.failedStep ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-status-failed)]" />
              <span className="font-mono text-sm text-[var(--color-text)] break-all">
                {failure.failedStep}
              </span>
            </span>
          ) : (
            <span className="text-xs text-[var(--color-muted)]">
              {t('panels.failure.stepUnknown')}
            </span>
          )}
        </div>
        <FailureBlock heading={t('panels.failure.reasonHeading')}>
          <p
            id={reasonId}
            className={cn(
              'text-sm whitespace-pre-wrap break-words',
              failure.message ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]',
            )}
          >
            {failure.message ?? t('panels.failure.reasonUnknown')}
          </p>
        </FailureBlock>
      </div>

      {failure.recentErrorLog && failure.recentErrorLog.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
            {t('panels.failure.recentLogHeading')}
          </p>
          <ul className="flex flex-col gap-0.5 rounded border border-[var(--color-status-failed)]/20 bg-[var(--color-surface)]/70 p-2">
            {failure.recentErrorLog.map((entry) => (
              <li
                key={`${entry.at}-${entry.level}-${entry.message}`}
                className="grid grid-cols-[auto_auto_1fr] gap-2 font-mono text-[11px]"
              >
                <span className="text-[var(--color-muted)]">{formatTime(entry.at)}</span>
                <span
                  className={cn(
                    'uppercase',
                    entry.level === 'error'
                      ? 'text-[var(--color-status-failed)]'
                      : 'text-[var(--color-alert)]',
                  )}
                >
                  {entry.level}
                </span>
                <span className="whitespace-pre-wrap break-words text-[var(--color-text)]">
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onRequestRetryAction ? (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="subtle"
            leading={<RefreshCcw size={11} />}
            aria-describedby={reasonId}
            onClick={() => onRequestRetryAction('retry', task)}
          >
            {t('panels.failure.retry')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leading={<Sparkles size={11} />}
            aria-describedby={reasonId}
            onClick={() => onRequestRetryAction('resume', task)}
          >
            {t('panels.failure.resume')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function FailureBlock({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        {heading}
      </p>
      {children}
    </div>
  )
}
