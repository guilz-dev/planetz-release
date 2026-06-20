import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

interface BusyPlaceholderProps {
  label: string
  hint?: string
  className?: string
  children?: ReactNode
}

export function BusyPlaceholder({ label, hint, className, children }: BusyPlaceholderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-4 py-6 text-center',
        className,
      )}
    >
      <Loader2
        size={20}
        className="animate-spin text-[var(--color-accent)] motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-xs text-[var(--color-text)]">{label}</p>
      {hint ? <p className="text-[10px] text-[var(--color-muted)]">{hint}</p> : null}
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}
