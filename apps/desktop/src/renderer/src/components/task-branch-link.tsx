import type { TaskViewModel } from '@planetz/shared'
import { FolderOpen, GitBranch } from 'lucide-react'
import { useI18n } from '../i18n'
import { cn } from './ui/cn'

interface TaskBranchLinkProps {
  task: TaskViewModel
  className?: string
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}

export function TaskBranchLink({ task, className, onOpenWorkDir }: TaskBranchLinkProps) {
  const { t } = useI18n()
  const branch = task.sourceBranch?.trim()
  const canOpen = Boolean(task.workDirPath && onOpenWorkDir)

  if (!branch && !canOpen) return null

  if (canOpen) {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-sm',
          'text-[var(--color-muted-strong)] hover:text-[var(--color-text)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]',
          className,
        )}
        title={branch}
        aria-label={t('panels.task.openWorkDirNoBranchAria')}
        onClick={(event) => {
          event.stopPropagation()
          if (onOpenWorkDir) void onOpenWorkDir(task)
        }}
      >
        <FolderOpen size={10} className="shrink-0" />
        <span className="truncate">{t('panels.task.openWorkDir')}</span>
      </button>
    )
  }

  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-1 truncate font-mono', className)}
      title={branch}
    >
      <GitBranch size={10} className="shrink-0" />
      <span className="truncate">{branch}</span>
    </span>
  )
}
