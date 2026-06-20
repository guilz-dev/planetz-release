import type { TaskWorkflowSelectionView } from '@planetz/shared'
import { Diamond, Zap } from 'lucide-react'
import { cn } from '../ui/cn.js'

export function TaskWorkflowBadge({
  workflow,
  selection,
  className,
}: {
  workflow?: string
  selection?: TaskWorkflowSelectionView
  className?: string
}) {
  const label = selection?.displayLabel ?? workflow
  if (!label) return null

  const kind = selection?.kind ?? 'manual'

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted-strong)]',
        className,
      )}
      title={label}
    >
      {kind === 'auto' ? <Zap size={10} className="shrink-0 text-[var(--color-accent)]" /> : null}
      {kind === 'modified' ? (
        <Diamond size={10} className="shrink-0 text-[var(--color-status-warn,#d97706)]" />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  )
}
