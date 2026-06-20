import { cn } from '../ui/cn'

export function TaskResultReportDots({
  total,
  activeIndex,
  labels,
}: {
  total: number
  activeIndex: number
  labels: string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
      {Array.from({ length: total }).map((_, i) => {
        const active = i === activeIndex
        return (
          <span key={labels[i] ?? String(i)} className="inline-flex items-center gap-1">
            <span
              className={cn(
                'inline-block size-1.5 rounded-full',
                active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]',
              )}
            />
            <span
              className={cn(
                'font-mono text-[10px]',
                active ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]',
              )}
            >
              {labels[i]}
            </span>
          </span>
        )
      })}
    </div>
  )
}
