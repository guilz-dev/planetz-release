import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'

export function WorkflowTargetListRow({
  displayLabel,
  internalName,
  tierReason,
  isHighlighted,
  onSelect,
  selectLabel = 'Select',
  disabled = false,
}: {
  displayLabel: string
  internalName: string
  tierReason?: string
  isHighlighted?: boolean
  onSelect: () => void
  selectLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-stretch gap-1 px-2 py-0.5">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isHighlighted}
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          isHighlighted
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-strong)]'
            : 'hover:bg-[var(--color-panel-strong)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="truncate font-medium">{displayLabel}</span>
        <span className="truncate font-mono text-[10px] text-[var(--color-muted)]">
          {internalName}
        </span>
        {tierReason ? (
          <span className="truncate text-[11px] text-[var(--color-muted)]">{tierReason}</span>
        ) : null}
      </button>
      <Button
        variant="primary"
        size="sm"
        className="h-auto shrink-0 self-center px-2 text-[10px]"
        disabled={disabled}
        onClick={onSelect}
      >
        {selectLabel}
      </Button>
    </div>
  )
}
