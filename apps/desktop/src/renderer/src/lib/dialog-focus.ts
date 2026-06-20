import type { RefObject } from 'react'
import { getFocusableElements } from './focusable-elements.js'

export function focusInitialDialogControl(
  panel: HTMLElement,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  const preferred = initialFocusRef?.current
  if (preferred && panel.contains(preferred)) {
    preferred.focus()
    return
  }
  const [first] = getFocusableElements(panel)
  first?.focus()
}

export function trapDialogTabKey(event: KeyboardEvent, panel: HTMLElement): void {
  if (event.key !== 'Tab') return
  const focusable = getFocusableElements(panel)
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !panel.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last || !panel.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}
