import type { ResultSummary, TaskResultBundle, TaskViewModel } from '@planetz/shared'
import { isTerminalTaskStatus } from '@planetz/shared'
import { ExternalLink, Maximize2, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { useTaskResultBundle } from '../hooks/use-task-result-bundle'
import { type I18nKey, useI18n } from '../i18n'
import { ReportMarkdownContent } from './report-markdown-content'
import { reportFormatLabel } from './task-result/report-format-label'
import { TaskPullRequestLink } from './task-result/task-pull-request-link'
import { TaskResultExternalNote } from './task-result/task-result-external-note'
import { TaskResultFrame } from './task-result/task-result-frame'
import { TaskResultFullView } from './task-result/task-result-full-view'
import { TaskResultReportDots } from './task-result/task-result-report-dots'
import { Button } from './ui/button'

const PREVIEW_MAX_LINES = 12

function resultErrorKey(errorCode: TaskResultBundle['errorCode']): I18nKey {
  switch (errorCode) {
    case 'task_not_found':
      return 'panels.result.errorTaskNotFound'
    case 'path_denied':
      return 'panels.result.errorPathDenied'
    case 'read_failed':
      return 'panels.result.errorReadFailed'
    default:
      return 'panels.result.loadError'
  }
}

function noReportsMessageKey(bundle: TaskResultBundle): I18nKey {
  if (bundle.noReportsReason === 'workflow_output_not_configured') {
    return 'panels.result.noReportsWorkflowOutputNotConfigured'
  }
  return 'panels.result.noReports'
}

interface TaskResultSectionProps {
  task: TaskViewModel
  result?: ResultSummary
  onOpenExecutionLog?: (task: TaskViewModel) => void
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}

export function TaskResultSection({
  task,
  result,
  onOpenExecutionLog,
  onOpenWorkDir,
}: TaskResultSectionProps) {
  const { t } = useI18n()
  const terminal = isTerminalTaskStatus(task.status)
  const { bundle, loading, reload } = useTaskResultBundle(task.id, terminal, task.updatedAt)
  const [fullOpen, setFullOpen] = useState(false)
  const [fullIndex, setFullIndex] = useState(0)
  const pullRequestFooter = result?.pullRequest ? (
    <TaskPullRequestLink pullRequest={result.pullRequest} className="mt-2 inline-flex" />
  ) : undefined

  if (!terminal) return null

  if (!bundle) {
    return (
      <TaskResultFrame
        title={t('panels.result.title')}
        accent={false}
        actions={null}
        footer={pullRequestFooter}
      >
        <p className="text-xs text-[var(--color-muted)]">
          {loading ? t('panels.result.loading') : t('panels.result.loadError')}
        </p>
        {!loading ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            leading={<RefreshCcw size={12} />}
            onClick={reload}
          >
            {t('panels.result.retry')}
          </Button>
        ) : null}
      </TaskResultFrame>
    )
  }

  if (bundle.status === 'external') {
    return (
      <TaskResultFrame
        title={t('panels.result.title')}
        accent={false}
        actions={null}
        footer={pullRequestFooter}
      >
        <TaskResultExternalNote
          task={task}
          onOpenExecutionLog={onOpenExecutionLog}
          onOpenWorkDir={onOpenWorkDir}
        />
      </TaskResultFrame>
    )
  }

  if (bundle.status === 'error') {
    return (
      <TaskResultFrame
        title={t('panels.result.title')}
        accent={false}
        actions={null}
        footer={pullRequestFooter}
      >
        <p className="text-xs text-[var(--color-status-failed)]">
          {t(resultErrorKey(bundle.errorCode))}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          leading={<RefreshCcw size={12} />}
          onClick={reload}
        >
          {t('panels.result.retry')}
        </Button>
      </TaskResultFrame>
    )
  }

  if (bundle.status === 'no_run' || bundle.status === 'no_reports') {
    return (
      <TaskResultFrame
        title={t('panels.result.title')}
        accent={false}
        actions={null}
        footer={pullRequestFooter}
      >
        <p className="text-xs text-[var(--color-muted-strong)]">
          {bundle.status === 'no_run' ? t('panels.result.noRun') : t(noReportsMessageKey(bundle))}
        </p>
        {onOpenExecutionLog ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            leading={<ExternalLink size={12} />}
            onClick={() => onOpenExecutionLog(task)}
          >
            {t('panels.result.openInLog')}
          </Button>
        ) : null}
      </TaskResultFrame>
    )
  }

  const partialFailed = task.status === 'failed' || task.status === 'exceeded'
  const primaryIndex = bundle.primaryIndex ?? 0
  const primary = bundle.reports[primaryIndex]

  if (!primary) {
    return (
      <TaskResultFrame
        title={t('panels.result.title')}
        accent={false}
        actions={null}
        footer={pullRequestFooter}
      >
        <p className="text-xs text-[var(--color-muted-strong)]">{t(noReportsMessageKey(bundle))}</p>
        {onOpenExecutionLog ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            leading={<ExternalLink size={12} />}
            onClick={() => onOpenExecutionLog(task)}
          >
            {t('panels.result.openInLog')}
          </Button>
        ) : null}
      </TaskResultFrame>
    )
  }

  const openFull = (index: number) => {
    setFullIndex(index)
    setFullOpen(true)
  }

  const reportLabels = bundle.reports.map((r) => reportFormatLabel(r))

  return (
    <>
      <TaskResultFrame
        title={t('panels.result.titleWithFormat', { format: reportFormatLabel(primary) })}
        accent={!partialFailed}
        warning={partialFailed}
        footer={pullRequestFooter}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leading={<Maximize2 size={11} />}
            onClick={() => openFull(primaryIndex)}
          >
            {t('panels.result.openFull')}
          </Button>
        }
      >
        <ReportMarkdownContent content={primary.content} maxSourceLines={PREVIEW_MAX_LINES} />
        {bundle.reports.length > 1 ? (
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2">
            <TaskResultReportDots
              total={bundle.reports.length}
              activeIndex={primaryIndex}
              labels={reportLabels}
            />
            <button
              type="button"
              onClick={() => openFull(primaryIndex)}
              className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
            >
              {t('panels.result.showAll', { count: bundle.reports.length })}
            </button>
          </div>
        ) : null}
        {partialFailed ? (
          <p className="mt-2 text-[11px] text-[var(--color-status-failed)]">
            {t('panels.result.partialFailed')}
          </p>
        ) : null}
      </TaskResultFrame>
      {fullOpen ? (
        <TaskResultFullView
          taskId={task.id}
          taskTitle={task.title}
          bundle={bundle}
          initialIndex={fullIndex}
          onClose={() => setFullOpen(false)}
        />
      ) : null}
    </>
  )
}
