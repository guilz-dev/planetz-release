import type { TaskStatusReason } from '@planetz/shared'
import type { I18nKey } from '../i18n/catalog'

const STATUS_REASON_I18N: Record<TaskStatusReason, I18nKey> = {
  task_failed: 'panels.failure.statusReason.taskFailed',
  pr_failed: 'panels.failure.statusReason.prFailed',
  iteration_exceeded: 'panels.failure.statusReason.iterationExceeded',
  workflow_aborted: 'panels.failure.statusReason.workflowAborted',
  interrupted: 'panels.failure.statusReason.interrupted',
  stopped: 'panels.failure.statusReason.stopped',
  unknown_status: 'panels.failure.statusReason.unknownStatus',
}

export function taskStatusReasonI18nKey(reason: TaskStatusReason | undefined): I18nKey | undefined {
  if (!reason) return undefined
  return STATUS_REASON_I18N[reason]
}
