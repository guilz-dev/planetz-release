import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cn } from './ui/cn'

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface FloatingPanelProps {
  children: ReactNode
  /** When set, position/size persist across sessions under this key. */
  storageKey?: string
  defaultWidth?: number
  minWidth?: number
  minHeight?: number
  /** Inset from the parent's bottom-left used for the initial (un-dragged) position. */
  inset?: number
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function loadGeom(storageKey?: string): Rect | null {
  if (!storageKey || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`floating-panel:${storageKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Rect>
    if (
      typeof parsed.left === 'number' &&
      typeof parsed.top === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return { left: parsed.left, top: parsed.top, width: parsed.width, height: parsed.height }
    }
  } catch {
    // ignore malformed storage
  }
  return null
}

/**
 * Absolutely-positioned panel that can be dragged by its child `<header>` and
 * resized from the bottom-right corner. Movement is clamped to the offset parent
 * (the nearest positioned ancestor), so it must live inside a `relative` container.
 */
export function FloatingPanel({
  children,
  storageKey,
  defaultWidth = 440,
  minWidth = 360,
  minHeight = 240,
  inset = 8,
  className,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [geom, setGeom] = useState<Rect | null>(() => loadGeom(storageKey))
  const [dragging, setDragging] = useState(false)
  const interaction = useRef<null | {
    kind: 'move' | 'resize'
    startX: number
    startY: number
    start: Rect
    parentW: number
    parentH: number
  }>(null)

  const persist = useCallback(
    (next: Rect) => {
      if (!storageKey || typeof window === 'undefined') return
      try {
        window.localStorage.setItem(`floating-panel:${storageKey}`, JSON.stringify(next))
      } catch {
        // ignore quota / serialization errors
      }
    },
    [storageKey],
  )

  // Keep a restored geometry within the parent's current bounds on mount.
  useLayoutEffect(() => {
    const el = panelRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    setGeom((current) => {
      if (!current) return current
      const clamped: Rect = {
        width: Math.min(current.width, parent.clientWidth),
        height: Math.min(current.height, parent.clientHeight),
        left: clamp(current.left, 0, Math.max(0, parent.clientWidth - current.width)),
        top: clamp(current.top, 0, Math.max(0, parent.clientHeight - current.height)),
      }
      const unchanged =
        clamped.left === current.left &&
        clamped.top === current.top &&
        clamped.width === current.width &&
        clamped.height === current.height
      return unchanged ? current : clamped
    })
  }, [])

  const measure = useCallback((): { rect: Rect; parentW: number; parentH: number } | null => {
    const el = panelRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return null
    const er = el.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    return {
      rect: {
        left: er.left - pr.left,
        top: er.top - pr.top,
        width: er.width,
        height: er.height,
      },
      parentW: parent.clientWidth,
      parentH: parent.clientHeight,
    }
  }, [])

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const state = interaction.current
      if (!state) return
      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (state.kind === 'move') {
        const left = clamp(state.start.left + dx, 0, state.parentW - state.start.width)
        const top = clamp(state.start.top + dy, 0, state.parentH - state.start.height)
        setGeom({ ...state.start, left, top })
      } else {
        const width = clamp(state.start.width + dx, minWidth, state.parentW - state.start.left)
        const height = clamp(state.start.height + dy, minHeight, state.parentH - state.start.top)
        setGeom({ ...state.start, width, height })
      }
    },
    [minWidth, minHeight],
  )

  const endInteraction = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endInteraction)
    interaction.current = null
    setDragging(false)
    setGeom((current) => {
      if (current) persist(current)
      return current
    })
  }, [onPointerMove, persist])

  const begin = useCallback(
    (kind: 'move' | 'resize', event: React.PointerEvent) => {
      const measured = measure()
      if (!measured) return
      event.preventDefault()
      interaction.current = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        start: measured.rect,
        parentW: measured.parentW,
        parentH: measured.parentH,
      }
      setGeom(measured.rect)
      setDragging(true)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endInteraction)
    },
    [measure, onPointerMove, endInteraction],
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      // Drag only from the panel header, and never when grabbing an interactive control.
      if (!target.closest('header')) return
      if (target.closest('button, a, input, textarea, select, [role="button"], [role="combobox"]'))
        return
      begin('move', event)
    },
    [begin],
  )

  const style: React.CSSProperties = geom
    ? { left: geom.left, top: geom.top, width: geom.width, height: geom.height }
    : { left: inset, bottom: inset, width: defaultWidth }

  return (
    <div
      ref={panelRef}
      className={cn(
        'pointer-events-auto absolute z-10 flex flex-col [&_header]:cursor-move [&_header]:select-none',
        dragging && 'select-none',
        className,
      )}
      style={style}
      onPointerDown={onPointerDown}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <div
        aria-hidden
        title="Drag to resize"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          begin('resize', event)
        }}
        className="absolute bottom-0 right-0 z-20 size-4 cursor-se-resize touch-none"
      >
        <span className="pointer-events-none absolute bottom-[3px] right-[3px] size-2 rounded-br-[3px] border-b-2 border-r-2 border-[var(--color-muted)]" />
      </div>
    </div>
  )
}
