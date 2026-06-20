import type { ExecutionLogRecord } from '@planetz/shared'
import { Copy, ExternalLink } from 'lucide-react'
import { useI18n } from '../i18n'
import { Button } from './ui/button'

interface ExecutionLogRowDetailProps {
  row: ExecutionLogRecord
  onOpenTask?: (taskId: string) => void
}

export function ExecutionLogRowDetail({ row, onOpenTask }: ExecutionLogRowDetailProps) {
  const { t } = useI18n()
  const taskId = row.taskId

  return (
    <div className="flex flex-col gap-2 text-xs">
      {row.message ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[var(--color-text)]">
          {row.message}
        </pre>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {row.level ? (
          <>
            <dt className="text-[var(--color-muted)]">{t('views.log.detailLevel')}</dt>
            <dd>{row.level}</dd>
          </>
        ) : null}
        {row.taskId ? (
          <>
            <dt className="text-[var(--color-muted)]">{t('views.log.detailTaskId')}</dt>
            <dd className="font-mono">{row.taskId}</dd>
          </>
        ) : null}
        {row.taskStatus ? (
          <>
            <dt className="text-[var(--color-muted)]">{t('views.log.detailTaskStatus')}</dt>
            <dd>{row.taskStatus}</dd>
          </>
        ) : null}
        <dt className="text-[var(--color-muted)]">{t('views.log.detailRun')}</dt>
        <dd className="flex items-center gap-2 font-mono">
          <span className="truncate">{row.runId}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('views.log.copyRunId')}
            onClick={(e) => {
              e.stopPropagation()
              void navigator.clipboard.writeText(row.runId)
            }}
          >
            <Copy size={11} />
          </Button>
        </dd>
      </dl>
      {taskId && onOpenTask ? (
        <Button
          type="button"
          variant="subtle"
          size="sm"
          leading={<ExternalLink size={11} />}
          onClick={(e) => {
            e.stopPropagation()
            onOpenTask(taskId)
          }}
        >
          {t('views.log.openTask')}
        </Button>
      ) : null}
    </div>
  )
}
