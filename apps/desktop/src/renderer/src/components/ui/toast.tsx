import { AlertOctagon, AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Toast } from '../../hooks/use-toast'
import { useI18n } from '../../i18n'
import { Button } from './button'
import { cn } from './cn'

interface ToastViewProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const KIND_STYLES: Record<
  Toast['kind'],
  { border: string; bg: string; text: string; icon: typeof Info }
> = {
  info: {
    border: 'border-[var(--color-status-running)]/40',
    bg: 'bg-[var(--color-status-running-soft)]',
    text: 'text-[var(--color-status-running)]',
    icon: Info,
  },
  success: {
    border: 'border-[var(--color-status-completed)]/40',
    bg: 'bg-[var(--color-status-completed)]/10',
    text: 'text-[var(--color-status-completed)]',
    icon: CheckCircle,
  },
  warn: {
    border: 'border-[var(--color-alert)]/40',
    bg: 'bg-[var(--color-status-pending-soft)]',
    text: 'text-[var(--color-alert)]',
    icon: AlertTriangle,
  },
  error: {
    border: 'border-[var(--color-status-failed)]/50',
    bg: 'bg-[var(--color-status-failed-soft)]',
    text: 'text-[var(--color-status-failed)]',
    icon: AlertOctagon,
  },
}

export function ToastView({ toast, onDismiss }: ToastViewProps) {
  const { t } = useI18n()
  const style = KIND_STYLES[toast.kind]
  const Icon = style.icon
  const isAlert = toast.kind === 'warn' || toast.kind === 'error'
  const [paused, setPaused] = useState(false)
  const startedAtRef = useRef<number>(Date.now())
  const remainingRef = useRef<number>(toast.durationMs)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (toast.durationMs <= 0) return
    function clear() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    function schedule(ms: number) {
      clear()
      startedAtRef.current = Date.now()
      timerRef.current = setTimeout(() => onDismiss(toast.id), ms)
    }
    if (paused) {
      const elapsed = Date.now() - startedAtRef.current
      remainingRef.current = Math.max(0, remainingRef.current - elapsed)
      clear()
    } else {
      schedule(remainingRef.current)
    }
    return clear
  }, [paused, toast.durationMs, toast.id, onDismiss])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pause auto-dismiss on hover
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-2 rounded-md border px-3 py-2 shadow-md backdrop-blur-sm',
        style.border,
        style.bg,
        style.text,
      )}
    >
      <Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-sm font-semibold leading-tight">{toast.title}</p> : null}
        <p
          className={cn(
            'text-sm leading-snug',
            toast.title ? 'mt-0.5 text-[var(--color-text)]' : null,
          )}
        >
          {toast.message}
        </p>
        {toast.action ? (
          <div className="mt-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                toast.action?.onClick()
                onDismiss(toast.id)
              }}
            >
              {toast.action.label}
            </Button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={t('toast.dismissAria')}
        onClick={() => onDismiss(toast.id)}
        className={cn(
          'shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--color-panel-strong)]/40',
          style.text,
        )}
      >
        <X size={12} />
      </button>
    </div>
  )
}
