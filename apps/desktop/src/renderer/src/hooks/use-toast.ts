import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'warn' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  title?: string
  /** Auto-dismiss after this many ms. 0 means sticky (user dismiss only). */
  durationMs: number
  action?: ToastAction
}

export interface ToastInput {
  kind: ToastKind
  message: string
  title?: string
  durationMs?: number
  action?: ToastAction
}

const MAX_TOASTS = 5

const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  info: 5_000,
  success: 5_000,
  warn: 8_000,
  error: 0,
}

interface ToastStore {
  toasts: Toast[]
  pushToast: (input: ToastInput) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

function nextId(): string {
  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (input) => {
    const id = nextId()
    const toast: Toast = {
      id,
      kind: input.kind,
      message: input.message,
      title: input.title,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS[input.kind],
      action: input.action,
    }
    set((s) => {
      const next = [...s.toasts, toast]
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next }
    })
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))

/** Component-side hook returning stable action references. */
export function usePushToast(): (input: ToastInput) => string {
  return useToastStore((s) => s.pushToast)
}

export function useDismissToast(): (id: string) => void {
  return useToastStore((s) => s.dismissToast)
}
