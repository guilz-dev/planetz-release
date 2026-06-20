import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

type PopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

const AnchorContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null)

interface PopoverProps {
  open: boolean
  onClose: () => void
  placement?: PopoverPlacement
  className?: string
  children: ReactNode
}

interface PopoverCoords {
  style: CSSProperties
  maxHeight: number
}

const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 6
const MIN_POPOVER_HEIGHT = 160

export function Popover({
  open,
  onClose,
  placement = 'top-start',
  className,
  children,
}: PopoverProps) {
  const anchorRef = useContext(AnchorContext)
  const ref = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<PopoverCoords | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef?.current
    if (!anchor) return

    function compute() {
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const vpH = window.innerHeight
      const vpW = window.innerWidth
      const isTop = placement.startsWith('top')
      const isEnd = placement.endsWith('end')

      const availableAbove = rect.top - VIEWPORT_MARGIN - ANCHOR_GAP
      const availableBelow = vpH - rect.bottom - VIEWPORT_MARGIN - ANCHOR_GAP
      // Auto-flip if requested side has less room than MIN_POPOVER_HEIGHT
      // and the opposite side has more room.
      let effectiveTop = isTop
      if (isTop && availableAbove < MIN_POPOVER_HEIGHT && availableBelow > availableAbove) {
        effectiveTop = false
      } else if (!isTop && availableBelow < MIN_POPOVER_HEIGHT && availableAbove > availableBelow) {
        effectiveTop = true
      }

      const maxHeight = effectiveTop ? availableAbove : availableBelow
      const style: CSSProperties = { position: 'fixed' }
      if (effectiveTop) {
        style.bottom = vpH - rect.top + ANCHOR_GAP
      } else {
        style.top = rect.bottom + ANCHOR_GAP
      }
      if (isEnd) {
        style.right = vpW - rect.right
      } else {
        style.left = rect.left
      }
      setCoords({ style, maxHeight: Math.max(MIN_POPOVER_HEIGHT, maxHeight) })
    }

    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, anchorRef, placement])

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      if (anchorRef?.current?.contains(e.target as Node)) return
      onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const style: CSSProperties = coords
    ? { ...coords.style, maxHeight: coords.maxHeight }
    : { position: 'fixed', visibility: 'hidden' }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={style}
      className={cn(
        'z-50 flex min-w-[14rem] flex-col overflow-y-auto rounded-md border border-[var(--color-border-strong)] bg-[var(--color-popover)] p-2.5 shadow-lg shadow-black/40',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

interface PopoverAnchorProps {
  className?: string
  children: ReactNode
}

export function PopoverAnchor({ className, children }: PopoverAnchorProps) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <AnchorContext.Provider value={ref}>
      <div ref={ref} className={cn('relative inline-flex', className)}>
        {children}
      </div>
    </AnchorContext.Provider>
  )
}
