import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './ui/cn'

interface PanelShellProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  density?: 'comfortable' | 'compact'
  /** When provided, renders a close (×) button in the header. */
  onClose?: () => void
  closeLabel?: string
}

export function PanelShell({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  density = 'comfortable',
  onClose,
  closeLabel,
}: PanelShellProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] shadow-lg shadow-black/40',
        className,
      )}
    >
      <header
        className={cn(
          'flex items-center justify-between gap-2 border-b border-[var(--color-border)]/70',
          density === 'compact' ? 'px-3 py-2' : 'px-4 py-2.5',
        )}
      >
        <div className="min-w-0 border-l border-[color-mix(in_oklab,var(--color-accent)_50%,black)] pl-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted-strong)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions || onClose ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            {onClose ? (
              <button
                type="button"
                aria-label={closeLabel ?? `Close ${title}`}
                className="inline-flex size-6 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
                onClick={onClose}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-auto',
          density === 'compact' ? 'p-2.5' : 'p-3',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}
