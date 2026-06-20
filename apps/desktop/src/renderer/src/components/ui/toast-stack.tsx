import { useDismissToast, useToastStore } from '../../hooks/use-toast'
import { ToastView } from './toast'

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useDismissToast()
  if (toasts.length === 0) return null
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </section>
  )
}
