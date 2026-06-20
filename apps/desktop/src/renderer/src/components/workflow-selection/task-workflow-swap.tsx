import type { TaskWorkflowSelectionView, WorkflowSummary } from '@planetz/shared'
import { filterUserVisibleWorkflows, stripRuntimeWorkflowOverrideSuffix } from '@planetz/shared'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePushToast } from '../../hooks/use-toast.js'
import { cn } from '../ui/cn.js'
import { Popover, PopoverAnchor } from '../ui/popover.js'
import { TaskWorkflowBadge } from './task-workflow-badge.js'

export function TaskWorkflowSwap({
  taskId,
  workflow,
  selection,
  workflows,
  disabled,
  className,
}: {
  taskId: string
  workflow?: string
  selection?: TaskWorkflowSelectionView
  workflows: WorkflowSummary[]
  disabled?: boolean
  className?: string
}) {
  const pushToast = usePushToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const currentWorkflow =
    stripRuntimeWorkflowOverrideSuffix(workflow ?? '') || selection?.baseWorkflow
  const selectableWorkflows = useMemo(
    () =>
      filterUserVisibleWorkflows(workflows, {
        preserveSelectedName: currentWorkflow,
      }),
    [workflows, currentWorkflow],
  )

  async function handleSwap(nextWorkflow: string) {
    if (busy || nextWorkflow === currentWorkflow) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      await window.orbit.swapTaskWorkflow({
        taskId,
        workflow: nextWorkflow,
        workflowMode: 'manual',
        selectionKind: 'manual',
      })
      setOpen(false)
    } catch (error) {
      pushToast({
        kind: 'error',
        title: 'Workflow swap failed',
        message: error instanceof Error ? error.message : 'Could not update workflow',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PopoverAnchor className={cn('inline-flex items-center gap-0.5', className)}>
      <TaskWorkflowBadge workflow={workflow} selection={selection} />
      <button
        type="button"
        disabled={disabled || busy}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className="focus-ring inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[var(--color-muted-strong)] hover:text-[var(--color-text)] disabled:opacity-50"
      >
        {busy ? <Loader2 size={10} className="animate-spin" /> : <ChevronDown size={10} />}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="w-56 p-0"
      >
        <ul className="max-h-48 overflow-auto py-1">
          {selectableWorkflows.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation()
                  void handleSwap(item.name)
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]/50 disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate font-mono">{item.name}</span>
                {item.name === currentWorkflow ? (
                  <Check size={11} className="shrink-0 text-[var(--color-accent)]" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </PopoverAnchor>
  )
}
