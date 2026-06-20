import type { AutoWorkflowDecision } from '@planetz/shared'
import { AlertTriangle, ChevronDown, ChevronRight, Waypoints } from 'lucide-react'
import { useState } from 'react'
import type { TranslateFn } from '../i18n/index.js'
import { cn } from './ui/cn'

/**
 * DESIGN MOCK (workflow Auto mode §6.1): inline Auto toggle to the right of the
 * workflow selector. Intentionally has no leading icon so it does not visually
 * duplicate the Refine button's Sparkles in the panel header.
 */
export function AutoToggle({
  on,
  disabled,
  onChange,
  ariaLabel,
  label,
}: {
  on: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
        'focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted-strong)]',
      )}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          'relative ml-0.5 inline-block h-4 w-7 rounded-full transition-colors',
          on ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            on ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

/** DESIGN MOCK: read-only workflow label shown when Auto=ON (selector disabled). */
export function WorkflowComboReadonly({
  label,
  isPlaceholder,
}: {
  label: string
  isPlaceholder: boolean
}) {
  return (
    <div
      aria-readonly="true"
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] pl-2.5 pr-3 text-left text-sm cursor-default select-none',
        isPlaceholder ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]',
      )}
    >
      <Waypoints size={13} className="shrink-0 text-[var(--color-accent)]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isPlaceholder ? null : (
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          auto
        </span>
      )}
    </div>
  )
}

export function AutoDecisionDetail({
  decision,
  t,
}: {
  decision: AutoWorkflowDecision
  t: TranslateFn
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--color-muted-strong)]"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{t('composer.autoDecisionTitle')}</span>
        {decision.fallbackApplied ? (
          <span className="ml-1 inline-flex items-center gap-1 text-[var(--color-status-failed)]">
            <AlertTriangle size={11} /> {t('composer.autoDecisionFallback')}
          </span>
        ) : null}
        <span className="ml-auto uppercase">{decision.confidence}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-2.5 py-2 text-[11px] text-[var(--color-muted-strong)]">
          <span>
            {t('composer.autoDecisionGroup')}{' '}
            <span className="font-medium text-[var(--color-text)]">{decision.group}</span>
          </span>
          <span>
            {t('composer.autoDecisionWorkflow')}{' '}
            <span className="font-medium text-[var(--color-accent)]">
              {decision.selectedWorkflow}
            </span>
          </span>
          {decision.reasonCodes.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              <span>{t('composer.autoDecisionReasons')}</span>
              <span className="font-mono text-[10px] leading-relaxed text-[var(--color-text)]">
                {decision.reasonCodes.join(' · ')}
              </span>
            </span>
          ) : null}
          {decision.llm?.failureCode ? (
            <span className="flex flex-col gap-0.5">
              <span>{t('composer.autoDecisionLlmFailure')}</span>
              <span className="font-mono text-[10px] text-[var(--color-status-failed)]">
                {decision.llm.failureCode}
                {decision.llm.latencyMs != null
                  ? ` (${Math.round(decision.llm.latencyMs / 1000)}s)`
                  : ''}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
