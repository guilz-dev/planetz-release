import { Plus } from 'lucide-react'
import type { ClosablePanelId } from '../store/app-store'

interface PanelRestoreStripProps {
  closed: ReadonlyArray<{ id: ClosablePanelId; label: string }>
  onRestore: (id: ClosablePanelId) => void
}

export function PanelRestoreStrip({ closed, onRestore }: PanelRestoreStripProps) {
  if (closed.length === 0) return null
  return (
    <div
      role="toolbar"
      aria-label="Restore closed panels"
      className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-panel)]/60 px-2 py-1 text-[11px] text-[var(--color-muted)] backdrop-blur-sm"
    >
      <span className="font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        Closed
      </span>
      {closed.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onRestore(p.id)}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-[var(--color-muted-strong)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
        >
          <Plus size={11} />
          {p.label}
        </button>
      ))}
    </div>
  )
}
