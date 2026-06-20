import { cn } from './ui/cn'

export function IssueTabSectionCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-4 backdrop-blur-sm',
        className,
      )}
    >
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-strong)]">{title}</h2>
      {children}
    </section>
  )
}
