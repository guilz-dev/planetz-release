import {
  filterWorkflowSummaries,
  tierMetaByWorkflowName,
  type WorkflowSummary,
  workflowPickerSurfacePrefsFromUi,
  workflowSummaryLabel,
} from '@planetz/shared'
import { ChevronDown, Plus, Search } from 'lucide-react'
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
import { useWorkflowPickerPrefs } from '../hooks/use-workflow-picker-prefs.js'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Input } from './ui/input'
import {
  buildWorkflowComboboxGroups,
  collectVisibleWorkflowItems,
  isWorkflowGroupExpanded,
} from './workflow-combobox-groups.js'
import { WorkflowGroupHeader } from './workflow-group-header.js'

interface WorkflowComboboxProps {
  workflows: WorkflowSummary[]
  value: string
  onChange: (name: string) => void
  onNewWorkflow?: () => void
  builtinWorkflowCategoryOrder?: string[]
  recentWorkflowNames?: string[]
  disabled?: boolean
  className?: string
}

export function WorkflowCombobox({
  workflows,
  value,
  onChange,
  onNewWorkflow,
  builtinWorkflowCategoryOrder = [],
  recentWorkflowNames = [],
  disabled,
  className,
}: WorkflowComboboxProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const pickerPrefs = useWorkflowPickerPrefs(open)
  const defaultSurfacePrefs = useMemo(() => workflowPickerSurfacePrefsFromUi({}), [])
  const surfacePrefs = pickerPrefs.prefs ?? defaultSurfacePrefs
  const tierMeta = useMemo(() => tierMetaByWorkflowName(workflows), [workflows])

  const selected = workflows.find((w) => w.name === value)
  const triggerLabel = selected ? workflowSummaryLabel(selected) : value || 'Select workflow'

  const filtered = useMemo(
    () => filterWorkflowSummaries(query, workflows, tierMeta),
    [query, workflows, tierMeta],
  )
  const groups = useMemo(
    () =>
      buildWorkflowComboboxGroups(
        filtered,
        builtinWorkflowCategoryOrder,
        recentWorkflowNames,
        surfacePrefs,
        query,
        undefined,
        false,
      ),
    [filtered, builtinWorkflowCategoryOrder, recentWorkflowNames, surfacePrefs, query],
  )

  const isSearching = query.trim().length > 0
  const selectedGroupKey = useMemo(() => {
    if (!value) return null
    const group = groups.find((g) => g.items.some((w) => w.name === value))
    return group?.key ?? null
  }, [groups, value])

  const visibleItems = useMemo(
    () => collectVisibleWorkflowItems(groups, isSearching, expandedGroups, selectedGroupKey),
    [groups, expandedGroups, isSearching, selectedGroupKey],
  )

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
      const desired = 360
      const spaceBelow = window.innerHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      const upward = spaceBelow < desired && spaceAbove > spaceBelow
      const style: CSSProperties = {
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(200, upward ? spaceAbove - gap : spaceBelow - gap),
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
    setActiveIndex((i) => (visibleItems.length === 0 ? 0 : Math.min(i, visibleItems.length - 1)))
  }, [visibleItems.length])

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listboxRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
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

  function selectWorkflow(name: string) {
    onChange(name)
    close()
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (visibleItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % visibleItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const wf = visibleItems[activeIndex]
      if (wf) selectWorkflow(wf.name)
    }
  }

  const renderedWorkflowNames = new Set<string>()

  return (
    <div ref={rootRef} className={cn('relative min-w-0 flex-1', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Workflow"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-8 text-left text-sm text-[var(--color-text)]',
          'focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
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
              aria-label="Workflow options"
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
                    placeholder="Filter workflows…"
                    value={query}
                    aria-label="Filter workflows"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' && visibleItems.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setActiveIndex(0)
                      }
                    }}
                  />
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
                {visibleItems.length === 0 && groups.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-muted)]">
                    No matching workflows
                  </p>
                ) : (
                  groups.map((group) => {
                    const expanded = isWorkflowGroupExpanded(
                      group,
                      isSearching,
                      expandedGroups,
                      selectedGroupKey,
                    )
                    return (
                      <div key={group.key} className="flex flex-col">
                        <WorkflowGroupHeader
                          group={group}
                          expanded={expanded}
                          onToggle={toggleGroup}
                        />
                        {expanded ? (
                          <ul className="pb-1">
                            {group.items.map((wf) => {
                              if (renderedWorkflowNames.has(wf.name)) return null
                              renderedWorkflowNames.add(wf.name)
                              const index = visibleItems.findIndex((item) => item.name === wf.name)
                              if (index < 0) return null
                              const selectedOption = wf.name === value
                              const active = index === activeIndex
                              return (
                                <li key={`${group.key}:${wf.name}`}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={selectedOption}
                                    className={cn(
                                      'flex w-full flex-col gap-0.5 px-3 py-1.5 pl-7 text-left text-sm transition-colors',
                                      active && 'bg-[var(--color-accent-soft)]',
                                      selectedOption && 'text-[var(--color-accent)]',
                                      !active &&
                                        !selectedOption &&
                                        'hover:bg-[var(--color-panel-strong)]',
                                    )}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => selectWorkflow(wf.name)}
                                  >
                                    <span className="truncate font-medium">
                                      {workflowSummaryLabel(wf)}
                                    </span>
                                    {wf.description ? (
                                      <span className="truncate text-[11px] text-[var(--color-muted)]">
                                        {wf.description}
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t border-[var(--color-border)] p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  leading={<Plus size={13} />}
                  disabled={!onNewWorkflow}
                  onClick={() => {
                    onNewWorkflow?.()
                    close()
                  }}
                >
                  New workflow
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
