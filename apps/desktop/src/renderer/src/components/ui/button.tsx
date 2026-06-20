import { Loader2 } from 'lucide-react'
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
  loading?: boolean
}

const SPINNER_SIZE: Record<Size, number> = { sm: 12, md: 13, lg: 14 }

const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:bg-[color-mix(in_oklab,var(--color-accent)_88%,white)]',
  secondary:
    'border border-[var(--color-border-strong)] bg-[var(--color-panel)] text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]',
  ghost:
    'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-status-failed)] text-white hover:bg-[color-mix(in_oklab,var(--color-status-failed)_85%,white)]',
  subtle:
    'bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent-soft)_70%,var(--color-accent))]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    className,
    leading,
    trailing,
    loading,
    disabled,
    children,
    type,
    ...rest
  },
  ref,
) {
  const spinner = loading ? (
    <Loader2
      size={SPINNER_SIZE[size]}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  ) : null
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {spinner ?? leading}
      {children}
      {loading ? null : trailing}
    </button>
  )
})
