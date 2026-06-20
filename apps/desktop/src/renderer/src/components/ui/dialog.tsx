import { X } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { focusInitialDialogControl, trapDialogTabKey } from '../../lib/dialog-focus.js'
import { cn } from './cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: ReactNode
  children?: ReactNode
  bodyClassName?: string
  /** When set, this control receives focus on open (e.g. Cancel in confirm flows). */
  initialFocusRef?: RefObject<HTMLElement | null>
}

const SIZE: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'h-[90vh] max-w-[min(1200px,95vw)]',
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  bodyClassName,
  initialFocusRef,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const panel = panelRef.current
      if (panel) trapDialogTabKey(e, panel)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const frame = requestAnimationFrame(() => {
      focusInitialDialogControl(panel, initialFocusRef)
    })
    return () => cancelAnimationFrame(frame)
  }, [open, initialFocusRef])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="document"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] shadow-2xl shadow-black/40',
          SIZE[size],
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="truncate text-base font-semibold text-[var(--color-text-strong)]"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </header>
        ) : null}
        {children ? (
          <div className={cn('flex-1 min-h-0', bodyClassName ?? 'overflow-auto px-5 py-4')}>
            {children}
          </div>
        ) : null}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
