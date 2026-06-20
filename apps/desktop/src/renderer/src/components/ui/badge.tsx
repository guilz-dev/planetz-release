import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Tone =
  | 'neutral'
  | 'accent'
  | 'pending'
  | 'running'
  | 'stopped'
  | 'completed'
  | 'failed'
  | 'exceeded'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  leading?: ReactNode
}

const TONES: Record<Tone, string> = {
  neutral:
    'bg-[var(--color-panel-strong)] text-[var(--color-muted-strong)] ring-1 ring-inset ring-[var(--color-border-strong)]',
  accent:
    'bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/30',
  pending:
    'bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)] ring-1 ring-inset ring-[var(--color-status-pending)]/30',
  running:
    'bg-[var(--color-status-running-soft)] text-[var(--color-status-running)] ring-1 ring-inset ring-[var(--color-status-running)]/30',
  stopped:
    'bg-[var(--color-status-stopped-soft)] text-[var(--color-status-stopped)] ring-1 ring-inset ring-[var(--color-status-stopped)]/30',
  completed:
    'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)] ring-1 ring-inset ring-[var(--color-status-completed)]/30',
  failed:
    'bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)] ring-1 ring-inset ring-[var(--color-status-failed)]/30',
  exceeded:
    'bg-[var(--color-status-exceeded-soft)] text-[var(--color-status-exceeded)] ring-1 ring-inset ring-[var(--color-status-exceeded)]/30',
}

export function Badge({ tone = 'neutral', className, leading, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
    </span>
  )
}
