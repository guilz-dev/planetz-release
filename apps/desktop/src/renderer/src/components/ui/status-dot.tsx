import type { AgentStatus, TaskStatus } from '@planetz/shared'
import { cn } from './cn'

type Tone = TaskStatus | AgentStatus | 'neutral'

interface StatusDotProps {
  tone: Tone
  pulse?: boolean
  className?: string
}

const COLOR: Record<Tone, string> = {
  pending: 'bg-[var(--color-status-pending)]',
  running: 'bg-[var(--color-status-running)]',
  stopped: 'bg-[var(--color-status-stopped)]',
  completed: 'bg-[var(--color-status-completed)]',
  failed: 'bg-[var(--color-status-failed)]',
  exceeded: 'bg-[var(--color-status-exceeded)]',
  idle: 'bg-[var(--color-status-pending)]',
  working: 'bg-[var(--color-status-running)]',
  reviewing: 'bg-[var(--color-status-running)]',
  waiting: 'bg-[var(--color-status-pending)]',
  error: 'bg-[var(--color-status-failed)]',
  neutral: 'bg-[var(--color-muted)]',
}

export function StatusDot({ tone, pulse, className }: StatusDotProps) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 items-center justify-center', className)}>
      {pulse ? (
        <span
          className={cn(
            'absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-60 motion-reduce:animate-none',
            COLOR[tone],
          )}
        />
      ) : null}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', COLOR[tone])} />
    </span>
  )
}
