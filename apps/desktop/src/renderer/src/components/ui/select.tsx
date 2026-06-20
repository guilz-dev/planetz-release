import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from './cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fullWidth?: boolean
}

export function Select({ className, fullWidth, children, ...rest }: SelectProps) {
  return (
    <span className={cn('relative inline-flex items-center', fullWidth ? 'w-full' : 'w-auto')}>
      <select
        className={cn(
          'focus-ring h-8 w-full appearance-none rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-8 text-sm text-[var(--color-text)]',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={2}
        className="pointer-events-none absolute right-2 text-[var(--color-muted)]"
      />
    </span>
  )
}
