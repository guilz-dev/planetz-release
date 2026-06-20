import type { ReactNode } from 'react'
import { cn } from './cn'

type TooltipSide = 'top' | 'bottom'
/** Horizontal anchor: `center` over the trigger, or `end` to align the bubble's right edge to the trigger (avoids clipping near a right border). */
type TooltipAlign = 'center' | 'end'

interface TooltipProps {
  label: string
  side?: TooltipSide
  align?: TooltipAlign
  /** Wider bubble for multi-sentence explanations. */
  wide?: boolean
  className?: string
  children: ReactNode
}

export function Tooltip({
  label,
  side = 'top',
  align = 'center',
  wide = false,
  className,
  children,
}: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max rounded-md border border-[var(--color-border-strong)] bg-[var(--color-popover)] px-2 py-1 text-[11px] font-normal leading-snug text-[var(--color-popover-foreground)] shadow-md',
          wide ? 'max-w-[16rem]' : 'max-w-[14rem]',
          align === 'center' && 'left-1/2 -translate-x-1/2 text-center',
          align === 'end' && 'right-0 text-left',
          'opacity-0 transition-opacity delay-500 duration-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 group-has-[:focus-visible]/tooltip:opacity-100',
          side === 'top' && 'bottom-full mb-1.5',
          side === 'bottom' && 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  )
}
