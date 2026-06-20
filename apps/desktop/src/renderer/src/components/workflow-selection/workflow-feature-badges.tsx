import type { WorkflowPreviewResult } from '@planetz/shared'
import { FileEdit, FlaskConical, Lock, Search } from 'lucide-react'
import { cn } from '../ui/cn.js'

const CHANGE_MODE_BADGE: Record<string, { label: string; cls: string }> = {
  read_only: {
    label: 'read-only',
    cls: 'bg-[var(--color-surface)] text-[var(--color-muted-strong)] border border-[var(--color-border-strong)]',
  },
  mixed: {
    label: 'mixed',
    cls: 'bg-[var(--color-status-warn,#b45309)]/15 text-[var(--color-status-warn,#d97706)]',
  },
  edit_heavy: {
    label: 'edit-heavy',
    cls: 'bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]',
  },
}

export function WorkflowFeatureBadges({ preview }: { preview: WorkflowPreviewResult }) {
  const mode = CHANGE_MODE_BADGE[preview.features.changeMode] ?? CHANGE_MODE_BADGE.mixed
  return (
    <div className="flex flex-wrap gap-1">
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium uppercase', mode?.cls)}>
        {mode?.label}
      </span>
      {preview.features.hasWriteTestsStep ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
          <FlaskConical size={10} /> tests
        </span>
      ) : null}
      {preview.features.dominantModes.includes('review') ||
      preview.features.dominantModes.includes('audit') ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-strong)]">
          <Search size={10} /> review
        </span>
      ) : null}
      {preview.features.changeMode !== 'read_only' ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-strong)]">
          <FileEdit size={10} /> edits
        </span>
      ) : null}
      {preview.strictTier ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-[var(--color-status-failed)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-status-failed)]">
          <Lock size={10} /> strict
        </span>
      ) : null}
      <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
        {preview.features.dominantModes.join(' + ')}
      </span>
    </div>
  )
}
