import type { ReactNode } from 'react'
import { cn } from './cn'

interface TabsProps<T extends string> {
  value: T
  onChange: (next: T) => void
  items: ReadonlyArray<{ value: T; label: ReactNode; leading?: ReactNode }>
  className?: string
}

export function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-strong)] shadow-sm shadow-black/20'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {item.leading}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
