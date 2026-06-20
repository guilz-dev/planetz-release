import { cn } from '../ui/cn'
import { findDanglingRefs, isReservedStepName } from './workflow-diagnostics.js'
import type { WorkflowDraft } from './workflow-draft-types.js'

interface WorkflowStepGraphProps {
  draft: WorkflowDraft
  className?: string
}

export function WorkflowStepGraph({ draft, className }: WorkflowStepGraphProps) {
  const dangling = findDanglingRefs(draft)
  const danglingSet = new Set(dangling.map((d) => `${d.from}:${d.next}`))

  if (draft.steps.length === 0) {
    return <p className={cn('text-xs text-[var(--color-muted)]', className)}>No steps yet</p>
  }

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4',
        className,
      )}
    >
      <div className="flex min-w-max flex-col items-center gap-3">
        {draft.steps.map((step, index) => {
          const isInitial = draft.initialStep === step.name
          const outgoing = step.rules.filter((r) => r.next)
          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'relative rounded-lg border px-4 py-2 text-center text-xs font-semibold',
                  isInitial
                    ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-panel)] text-[var(--color-text-strong)]',
                )}
              >
                {isInitial ? (
                  <span className="absolute -right-1 -top-1 text-[10px]" title="initial step">
                    ⚑
                  </span>
                ) : null}
                {step.name || `step ${index + 1}`}
                {step.special ? (
                  <span className="ml-1 text-[10px] font-normal text-[var(--color-muted)]">
                    ({step.special})
                  </span>
                ) : null}
              </div>
              {outgoing.length > 0 ? (
                <div className="flex flex-col items-center gap-1">
                  {outgoing.map((rule) => {
                    const edgeKey = `${step.name}:${rule.next}`
                    const isDangling = danglingSet.has(edgeKey)
                    const isTerminal = isReservedStepName(rule.next)
                    return (
                      <div key={rule.id} className="flex flex-col items-center gap-0.5">
                        <span className="max-w-[12rem] truncate text-[10px] text-[var(--color-muted)]">
                          {rule.text || rule.mode}
                        </span>
                        <span
                          className={cn(
                            'text-[10px]',
                            isDangling
                              ? 'text-[var(--color-status-failed)] line-through'
                              : 'text-[var(--color-muted-strong)]',
                          )}
                        >
                          ↓ {rule.next}
                        </span>
                        {isTerminal ? (
                          <span className="rounded border border-dashed border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                            ({rule.next})
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="text-[10px] text-[var(--color-muted)]">(no transitions)</span>
              )}
              {index < draft.steps.length - 1 ? (
                <span className="text-[var(--color-muted)] opacity-40">│</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
