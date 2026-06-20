import type { TaskViewModel } from '@planetz/shared'
import type { ComponentProps, ReactNode } from 'react'
import { useAsyncTaskAction } from '../hooks/use-async-task-action'
import { Button } from './ui/button'

interface DetailTaskActionButtonProps {
  task: TaskViewModel
  onAction: (task: TaskViewModel) => Promise<void>
  label: string
  ariaLabel: string
  leading: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  className?: string
}

export function DetailTaskActionButton({
  task,
  onAction,
  label,
  ariaLabel,
  leading,
  variant = 'subtle',
  className = 'self-start',
}: DetailTaskActionButtonProps) {
  const { busy, run } = useAsyncTaskAction(onAction)
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      leading={leading}
      disabled={busy}
      aria-label={ariaLabel}
      onClick={() => void run(task)}
    >
      {label}
    </Button>
  )
}
