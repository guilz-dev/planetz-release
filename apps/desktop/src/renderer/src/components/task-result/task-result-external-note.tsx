import type { TaskViewModel } from '@planetz/shared'
import { ExternalLink, FolderOpen } from 'lucide-react'
import { useI18n } from '../../i18n'
import { Button } from '../ui/button'

export function TaskResultExternalNote({
  task,
  onOpenExecutionLog,
  onOpenWorkDir,
}: {
  task: TaskViewModel
  onOpenExecutionLog?: (task: TaskViewModel) => void
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}) {
  const { t } = useI18n()
  return (
    <div
      role="note"
      className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/40 p-2.5"
    >
      <p className="text-xs text-[var(--color-muted-strong)]">{t('panels.result.external')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {onOpenWorkDir ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leading={<FolderOpen size={12} />}
            onClick={() => void onOpenWorkDir(task)}
          >
            {t('panels.result.openWorktree')}
          </Button>
        ) : null}
        {onOpenExecutionLog ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leading={<ExternalLink size={12} />}
            onClick={() => onOpenExecutionLog(task)}
          >
            {t('panels.result.openInLog')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
