import type { FacetKind } from '@planetz/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../ui/button'
import { cn } from '../../ui/cn'
import { FACET_KIND_DEFS } from './facet-kind-defs'

interface FacetNewEmptyPaneProps {
  busy?: boolean
  onCreate: (kind: FacetKind) => void
}

export function FacetNewEmptyPane({ busy = false, onCreate }: FacetNewEmptyPaneProps) {
  const [kind, setKind] = useState<FacetKind | null>(null)

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 px-6 py-10">
      <p className="mb-4 max-w-sm text-center text-xs text-[var(--color-muted-strong)]">
        Choose a facet type, then create a new workspace facet.
      </p>

      <div className="flex w-full max-w-xs flex-col gap-1" role="listbox" aria-label="Facet type">
        {FACET_KIND_DEFS.map((def) => {
          const selected = kind === def.kind
          return (
            <div key={def.kind}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={busy}
                onClick={() => setKind(def.kind)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  selected
                    ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/40 text-[var(--color-text-strong)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]/60 text-[var(--color-muted-strong)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]/40 hover:text-[var(--color-text-strong)]',
                )}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-muted)]">
                  {def.icon}
                </span>
                <span className="font-medium">{def.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      <Button
        variant="primary"
        size="md"
        className="mt-5"
        leading={<Plus size={14} />}
        disabled={!kind || busy}
        onClick={() => {
          if (!kind) return
          onCreate(kind)
        }}
      >
        New facet
      </Button>
    </div>
  )
}
