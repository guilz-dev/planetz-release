import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

const FIELD_BASE =
  'focus-ring block w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-cat-mantle)] px-2.5 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, className)} {...rest} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, 'min-h-20 resize-y font-[var(--font-mono)]', className)}
      {...rest}
    />
  )
})

interface FieldLabelProps {
  label: string
  hint?: string
  htmlFor?: string
  /** Optional message rendered directly below the label, above the control. */
  notice?: React.ReactNode
  children: React.ReactNode
}

export function Field({ label, hint, htmlFor, notice, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      {notice}
      {children}
      {hint ? <span className="text-[11px] text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  )
}
