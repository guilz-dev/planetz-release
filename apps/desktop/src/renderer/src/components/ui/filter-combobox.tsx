import { ChevronDown, Search } from 'lucide-react'
import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { Input } from './input'

export interface FilterComboboxOption {
  value: string
  label: string
}

interface FilterComboboxProps {
  options: FilterComboboxOption[]
  value: string
  onChange: (value: string) => void
  /** Associates the trigger with an external <label htmlFor={id}>. */
  id?: string
  /** Accessible name for the trigger button. */
  ariaLabel?: string
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string
  /** Placeholder for the filter input. */
  searchPlaceholder?: string
  /** Shown when the filter matches nothing. */
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * A select replacement that filters its options by typed input — the same
 * interaction as {@link WorkflowCombobox} but generic and flat (no groups).
 * Use this instead of a native `<select>` whenever the option list is long
 * enough that scanning it visually is painful (e.g. model pickers).
 */
export function FilterCombobox({
  options,
  value,
  onChange,
  id,
  ariaLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Filter…',
  emptyLabel = 'No matches',
  disabled,
  className,
}: FilterComboboxProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null)

  const selected = options.find((o) => o.value === value)
  const triggerLabel = selected ? selected.label : value || placeholder

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [query, options])

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    if (!trigger) return

    function compute() {
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const margin = 8
      const gap = 6
      const desired = 320
      const spaceBelow = window.innerHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      const upward = spaceBelow < desired && spaceAbove > spaceBelow
      const style: CSSProperties = {
        position: 'fixed',
        left: rect.left,
        minWidth: rect.width,
        maxHeight: Math.max(180, upward ? spaceAbove - gap : spaceBelow - gap),
      }
      if (upward) {
        style.bottom = window.innerHeight - rect.top + gap
      } else {
        style.top = rect.bottom + gap
      }
      setPopoverStyle(style)
    }

    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    if (!open) return
    function dismiss() {
      setOpen(false)
      setQuery('')
    }
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listboxRef.current?.contains(target)) return
      dismiss()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function select(next: string) {
    onChange(next)
    close()
    triggerRef.current?.focus()
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = filtered[activeIndex]
      if (option) select(option.value)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        className={cn(
          'focus-ring flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-8 text-left text-sm text-[var(--color-text)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
          if (open) setQuery('')
        }}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={cn(
            'pointer-events-none absolute right-2 shrink-0 text-[var(--color-muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={listboxRef}
              role="listbox"
              id={listboxId}
              aria-label={ariaLabel}
              style={popoverStyle ?? { position: 'fixed', visibility: 'hidden' }}
              className="z-50 flex min-w-[14rem] flex-col overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-popover)] shadow-lg shadow-black/40"
              onKeyDown={handleListKeyDown}
            >
              <div className="border-b border-[var(--color-border)] p-2">
                <span className="relative inline-flex w-full items-center">
                  <Search
                    size={12}
                    className="pointer-events-none absolute left-2.5 text-[var(--color-muted)]"
                  />
                  <Input
                    ref={searchRef}
                    type="search"
                    className="h-8 pl-7"
                    placeholder={searchPlaceholder}
                    value={query}
                    aria-label={searchPlaceholder}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' && filtered.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setActiveIndex(0)
                      }
                    }}
                  />
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-muted)]">{emptyLabel}</p>
                ) : (
                  <ul>
                    {filtered.map((option, index) => {
                      const selectedOption = option.value === value
                      const active = index === activeIndex
                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedOption}
                            className={cn(
                              'flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors',
                              active && 'bg-[var(--color-accent-soft)]',
                              selectedOption && 'text-[var(--color-accent)]',
                              !active && !selectedOption && 'hover:bg-[var(--color-panel-strong)]',
                            )}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => select(option.value)}
                          >
                            <span className="truncate">{option.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
