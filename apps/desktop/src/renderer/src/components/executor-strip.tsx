import type { ExecutorState } from '@planetz/shared'
import { Plug } from 'lucide-react'
import { StatusDot } from './ui/status-dot'

interface ExecutorStripProps {
  executors: ExecutorState[]
  selectedExecutorId?: string
  onSelect?: (executorId: string) => void
}

function isActive(executor: ExecutorState): boolean {
  return executor.status === 'working' || executor.status === 'reviewing'
}

export function ExecutorStrip({ executors, selectedExecutorId, onSelect }: ExecutorStripProps) {
  const activeCount = executors.filter(isActive).length

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
        Executors
      </span>
      <ul className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {executors.length === 0 ? (
          <li className="text-[11px] text-[var(--color-muted)]">No executors registered</li>
        ) : (
          executors.map((executor) => {
            const active = isActive(executor)
            const count = executor.activeTaskIds.length
            const selected = selectedExecutorId === executor.id
            return (
              <li key={executor.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect?.(executor.id)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ' +
                    (selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-panel-strong)] text-[var(--color-text-strong)]'
                      : 'border-[var(--color-border)] bg-[var(--color-panel)]/60 text-[var(--color-text)] hover:border-[var(--color-border-strong)]')
                  }
                >
                  <StatusDot tone={executor.status} pulse={active} />
                  <span className="font-medium">{executor.displayName}</span>
                  {executor.runtime === 'external' ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-muted)]">
                      <Plug size={9} />
                    </span>
                  ) : null}
                  <span className="text-[var(--color-muted)]">
                    {count > 0 ? `${count} active` : 'idle'}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
      <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
        {activeCount} / {executors.length} active
      </span>
    </div>
  )
}
