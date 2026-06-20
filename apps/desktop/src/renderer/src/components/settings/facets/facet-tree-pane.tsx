import { ChevronDown, ChevronRight, Link2, Package, Plus } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../ui/cn'
import { Tooltip } from '../../ui/tooltip'
import type { FacetListingSource } from '../workflow-facets-build-items.js'
import { FACET_KIND_DEFS, type FacetKind } from './facet-kind-defs'

export interface FacetTreeItemData {
  kind: FacetKind
  key: string
  source: 'project' | 'builtin'
  listingSource?: FacetListingSource
  index?: number
  stepReferences?: number
  workflowReferences?: number
  referencingStepNames?: string[]
}

interface FacetTreePaneProps {
  itemsByKind: Record<FacetKind, FacetTreeItemData[]>
  selected: { kind: FacetKind; key: string } | null
  collapsed: Set<FacetKind>
  showBuiltin: boolean
  onToggleBuiltin: (show: boolean) => void
  onSelect: (item: { kind: FacetKind; key: string }) => void
  onToggleCollapse: (kind: FacetKind) => void
  onAdd: (kind: FacetKind) => void
  onNavigateToSteps?: (payload: { kind: FacetKind; key: string; stepNames: string[] }) => void
  allowAdd?: boolean
}

const LISTING_BADGE: Record<FacetListingSource, string> = {
  workflowMap: 'In workflow',
  stepRef: 'Step ref',
  bundledCatalog: 'Bundled',
}

export function FacetTreePane({
  itemsByKind,
  selected,
  collapsed,
  showBuiltin,
  onToggleBuiltin,
  onSelect,
  onToggleCollapse,
  onAdd,
  onNavigateToSteps,
  allowAdd = true,
}: FacetTreePaneProps) {
  return (
    <div className="flex w-60 shrink-0 flex-col gap-2">
      <p className="px-1 text-[10px] leading-snug text-[var(--color-muted-strong)]">
        Defines keys and paths for this workflow. Assign which key each step uses on the Steps tab.
      </p>
      <label className="mb-1 inline-flex cursor-pointer items-center gap-2 px-1 text-[11px] text-[var(--color-muted-strong)]">
        <input
          type="checkbox"
          checked={showBuiltin}
          onChange={(e) => onToggleBuiltin(e.target.checked)}
          className="h-3.5 w-3.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
        Show all bundled facets (catalog)
      </label>
      {FACET_KIND_DEFS.map((k) => {
        const list = itemsByKind[k.kind]
        const isCollapsed = collapsed.has(k.kind)
        return (
          <div key={k.kind} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleCollapse(k.kind)}
                className="flex flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel)]/40 hover:text-[var(--color-text-strong)]"
              >
                {isCollapsed ? (
                  <ChevronRight size={11} aria-hidden />
                ) : (
                  <ChevronDown size={11} aria-hidden />
                )}
                <span className="inline-flex items-center gap-1">
                  {k.icon}
                  {k.label}
                </span>
                <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                  ({list.length})
                </span>
              </button>
              {allowAdd ? (
                <Tooltip side="bottom" label={`Add ${k.label.toLowerCase()}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-6 !w-6 !px-0"
                    onClick={() => onAdd(k.kind)}
                  >
                    <Plus size={11} />
                  </Button>
                </Tooltip>
              ) : null}
            </div>
            {!isCollapsed ? (
              list.length === 0 ? (
                <p className="px-2 py-1 text-[10px] italic text-[var(--color-muted)]">
                  None — click + to add
                </p>
              ) : (
                <div className="flex flex-col gap-0.5 pl-3">
                  {list.map((item) => (
                    <FacetTreeRow
                      key={`${item.listingSource}:${item.source}:${item.key || `(new-${item.index ?? 'b'})`}`}
                      item={item}
                      isSelected={selected?.kind === item.kind && selected?.key === item.key}
                      onSelect={() => onSelect({ kind: item.kind, key: item.key })}
                      onNavigateToSteps={onNavigateToSteps}
                    />
                  ))}
                </div>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

interface FacetTreeRowProps {
  item: FacetTreeItemData
  isSelected: boolean
  onSelect: () => void
  onNavigateToSteps?: FacetTreePaneProps['onNavigateToSteps']
}

function FacetTreeRow({ item, isSelected, onSelect, onNavigateToSteps }: FacetTreeRowProps) {
  const isEmptyKey = !item.key
  const refCount = item.stepReferences ?? 0
  const wfCount = item.workflowReferences ?? 0
  const stepNames = item.referencingStepNames ?? []
  const listingLabel = item.listingSource ? LISTING_BADGE[item.listingSource] : null

  const icon =
    item.listingSource === 'workflowMap' ||
    (item.listingSource === undefined && item.source === 'project') ? (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[var(--color-accent)]">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    ) : item.listingSource === 'stepRef' ? (
      <Tooltip side="bottom" label="Referenced by steps (not in workflow section map)">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[var(--color-status-pending)]">
          <Link2 size={11} />
        </span>
      </Tooltip>
    ) : (
      <Tooltip side="bottom" label="Bundled catalog entry">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[var(--color-muted)]">
          <Package size={11} />
        </span>
      </Tooltip>
    )

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md border px-1 py-0.5 transition-colors',
        isSelected
          ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/40'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]/40 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]/40',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs"
      >
        {icon}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            isEmptyKey
              ? 'italic text-[var(--color-muted)]'
              : item.listingSource === 'workflowMap' ||
                  (item.listingSource === undefined && item.source === 'project')
                ? 'font-medium text-[var(--color-text-strong)]'
                : 'text-[var(--color-muted-strong)]',
          )}
        >
          {item.key || '(new — set a key)'}
        </span>
        {listingLabel ? (
          <span className="shrink-0 rounded bg-[var(--color-panel-strong)]/60 px-1 text-[9px] text-[var(--color-muted)]">
            {listingLabel}
          </span>
        ) : null}
      </button>
      {refCount > 0 && onNavigateToSteps && stepNames.length > 0 ? (
        <Tooltip
          side="bottom"
          label={
            stepNames.length > 0
              ? `Used by: ${stepNames.join(', ')} — open Steps tab`
              : `Used by ${refCount} step${refCount === 1 ? '' : 's'}`
          }
        >
          <button
            type="button"
            aria-label={`Open ${refCount} step${refCount === 1 ? '' : 's'} on Steps tab`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            onClick={() => onNavigateToSteps({ kind: item.kind, key: item.key, stepNames })}
          >
            <Link2 size={9} />
            {refCount}
          </button>
        </Tooltip>
      ) : refCount > 0 ? (
        <Tooltip
          side="bottom"
          label={
            stepNames.length > 0
              ? `Used by: ${stepNames.join(', ')}`
              : `Used by ${refCount} step${refCount === 1 ? '' : 's'}`
          }
        >
          <span className="inline-flex shrink-0 items-center gap-0.5 px-1 text-[10px] text-[var(--color-muted)]">
            <Link2 size={9} />
            {refCount}
          </span>
        </Tooltip>
      ) : null}
      {wfCount > 0 ? (
        <Tooltip side="bottom" label={`Used by ${wfCount} workflow${wfCount === 1 ? '' : 's'}`}>
          <span className="inline-flex shrink-0 items-center gap-0.5 px-1 text-[10px] text-[var(--color-muted)]">
            {wfCount}w
          </span>
        </Tooltip>
      ) : null}
    </div>
  )
}
