import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  className,
  'aria-label': ariaLabel,
  ...rest
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
        'focus-ring',
        checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-panel-strong)]',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
