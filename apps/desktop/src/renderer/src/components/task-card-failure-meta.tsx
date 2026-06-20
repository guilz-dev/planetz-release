import type { TaskFailure, TaskStatusReason } from '@planetz/shared'
import { AlertOctagon } from 'lucide-react'
import { useI18n } from '../i18n'
import { taskStatusReasonI18nKey } from '../lib/task-status-reason-label'

interface TaskCardFailureMetaProps {
  failure: TaskFailure
  statusReason?: TaskStatusReason
  rawStatus?: string
}

const MESSAGE_CLIP_CHARS = 80

function clip(s: string): string {
  return s.length > MESSAGE_CLIP_CHARS ? `${s.slice(0, MESSAGE_CLIP_CHARS - 1)}…` : s
}

export function TaskCardFailureMeta({
  failure,
  statusReason,
  rawStatus,
}: TaskCardFailureMetaProps) {
  const { t } = useI18n()
  const reasonKey = taskStatusReasonI18nKey(statusReason)
  const reasonLabel = reasonKey
    ? statusReason === 'unknown_status'
      ? t(reasonKey, { raw: rawStatus ?? '?' })
      : t(reasonKey)
    : null
  const stepLabel = failure.failedStep
    ? t('panels.failure.cardStep', { step: failure.failedStep })
    : (reasonLabel ?? t('panels.failure.cardReason'))
  const messageLine = failure.message ? clip(failure.message.split(/\r?\n/, 1)[0]) : null

  return (
    <div
      className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[var(--color-status-failed)]"
      title={failure.message ?? undefined}
    >
      <AlertOctagon size={11} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex flex-col">
        <span className="font-mono text-[var(--color-status-failed)]">{stepLabel}</span>
        {messageLine ? (
          <span className="truncate font-mono text-[10px] text-[var(--color-muted-strong)]">
            {messageLine}
          </span>
        ) : null}
      </div>
    </div>
  )
}
