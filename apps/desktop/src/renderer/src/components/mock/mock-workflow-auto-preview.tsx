import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  Send,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'

/**
 * Design mock for the "Workflow Auto mode" spec
 * (docs/issues/planetz-workflow-auto-mode-design-2026-05-29.md §6 UI/UX).
 *
 * Static, self-contained preview for design review only — no IPC, no store,
 * no real Auto routing. Open at `#mock/workflow-auto`.
 */

type Confidence = 'high' | 'medium' | 'low'

interface AutoDecisionMock {
  selectedWorkflow: string
  group: string
  confidence: Confidence
  score: number
  fallbackApplied: boolean
  alternatives: { name: string; group: string; score: number }[]
  reasonCodes: string[]
}

const DECISION_HIGH: AutoDecisionMock = {
  selectedWorkflow: 'feature-implement',
  group: 'feature',
  confidence: 'high',
  score: 0.82,
  fallbackApplied: false,
  alternatives: [
    { name: 'refactor-safe', group: 'refactor', score: 0.41 },
    { name: 'default', group: 'general', score: 0.22 },
  ],
  reasonCodes: ['group:feature', 'keyword:実装', 'recent:feature-implement'],
}

const DECISION_LOW: AutoDecisionMock = {
  selectedWorkflow: 'default',
  group: 'general',
  confidence: 'low',
  score: 0.19,
  fallbackApplied: true,
  alternatives: [
    { name: 'research-spike', group: 'research', score: 0.18 },
    { name: 'docs-write', group: 'docs', score: 0.12 },
  ],
  reasonCodes: ['fallback:default', 'low-confidence'],
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-[var(--color-status-ok)]/15 text-[var(--color-status-ok)]',
  medium: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  low: 'bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]',
}

function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
        CONFIDENCE_STYLE[value],
      )}
    >
      {value}
    </span>
  )
}

/** Inline replica of the planned Auto toggle (workflow selector right side). */
function AutoToggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto workflow"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        on
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted-strong)]',
      )}
    >
      <Sparkles size={13} className={on ? '' : 'opacity-60'} />
      <span>Auto</span>
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

/** Read-only combobox label used when Auto=ON (selector is not interactive). */
function WorkflowComboReadonly({
  label,
  isPlaceholder,
}: {
  label: string
  isPlaceholder: boolean
}) {
  return (
    <div
      aria-disabled
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/60 pl-2.5 pr-3 text-left text-sm',
        isPlaceholder ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]',
      )}
    >
      <Sparkles size={13} className="shrink-0 text-[var(--color-accent)]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        auto
      </span>
    </div>
  )
}

/** Interactive (manual) combobox replica used when Auto=OFF. */
function WorkflowComboManual({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="focus-ring flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-2 text-left text-sm text-[var(--color-text)]"
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <ChevronDown size={14} className="shrink-0 text-[var(--color-muted)]" />
    </button>
  )
}

function DecisionDetail({ decision }: { decision: AutoDecisionMock }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--color-muted-strong)]"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>Auto decision</span>
        {decision.fallbackApplied ? (
          <span className="ml-1 inline-flex items-center gap-1 text-[var(--color-status-failed)]">
            <AlertTriangle size={11} /> fallback
          </span>
        ) : null}
        <span className="ml-auto">
          <ConfidenceBadge value={decision.confidence} />
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-2.5 py-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-muted-strong)]">
            <span>
              group <span className="font-medium text-[var(--color-text)]">{decision.group}</span>
            </span>
            <span>
              workflow{' '}
              <span className="font-medium text-[var(--color-accent)]">
                {decision.selectedWorkflow}
              </span>
            </span>
            <span>
              score{' '}
              <span className="font-medium text-[var(--color-text)]">
                {decision.score.toFixed(2)}
              </span>
            </span>
          </div>
          {decision.alternatives.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Alternatives
              </span>
              <ul className="flex flex-col gap-0.5">
                {decision.alternatives.slice(0, 3).map((alt) => (
                  <li
                    key={alt.name}
                    className="flex items-center gap-2 text-[var(--color-muted-strong)]"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {alt.name}
                      <span className="ml-1 text-[var(--color-muted)]">({alt.group})</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                      {alt.score.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {decision.reasonCodes.map((code) => (
              <span
                key={code}
                className="rounded bg-[var(--color-surface)] px-1.5 py-px text-[10px] text-[var(--color-muted)]"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Toast preview shown after submit (Auto: <group> → <workflow> (<confidence>)). */
function DecisionToast({ decision }: { decision: AutoDecisionMock }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg shadow-black/30',
        decision.fallbackApplied
          ? 'border-[var(--color-status-failed)]/40 bg-[var(--color-panel)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-panel)]',
      )}
    >
      {decision.fallbackApplied ? (
        <AlertTriangle size={14} className="mt-px shrink-0 text-[var(--color-status-failed)]" />
      ) : (
        <Check size={14} className="mt-px shrink-0 text-[var(--color-status-ok)]" />
      )}
      <span className="text-[var(--color-text)]">
        Auto: <span className="font-medium">{decision.group}</span> →{' '}
        <span className="font-medium text-[var(--color-accent)]">{decision.selectedWorkflow}</span>{' '}
        <span className="text-[var(--color-muted)]">({decision.confidence})</span>
        {decision.fallbackApplied ? (
          <span className="ml-1 text-[var(--color-status-failed)]">· fallback applied</span>
        ) : null}
      </span>
    </div>
  )
}

/** One Add Task card variant for the side-by-side review. */
function AddTaskCard({
  caption,
  autoMode,
  decision,
  showToast,
  showDetail,
  placeholder,
}: {
  caption: string
  autoMode: boolean
  decision: AutoDecisionMock | null
  showToast?: boolean
  showDetail?: boolean
  placeholder?: boolean
}) {
  const [auto, setAuto] = useState(autoMode)

  const comboLabel = placeholder
    ? 'Auto — workflow chosen on submit'
    : (decision?.selectedWorkflow ?? 'Auto')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {caption}
      </p>
      <section className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Add Task</h3>
          <Button variant="ghost" size="sm" leading={<Settings2 size={12} />}>
            Advanced
          </Button>
        </div>

        {/* §6.1 header row: workflow selector (left) + Auto toggle (right) */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {auto ? (
              <WorkflowComboReadonly label={comboLabel} isPlaceholder={Boolean(placeholder)} />
            ) : (
              <WorkflowComboManual value={decision?.selectedWorkflow ?? 'default'} />
            )}
          </div>
          <AutoToggle on={auto} onChange={setAuto} />
        </div>

        {auto && showDetail && decision ? <DecisionDetail decision={decision} /> : null}

        <textarea
          readOnly
          rows={3}
          defaultValue="ログイン画面にパスワードリセット導線を実装したい"
          className="w-full resize-none rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-text)] focus:outline-none"
        />

        <div className="flex items-center justify-end gap-2">
          <Button variant="subtle" size="sm" leading={<Play size={13} />}>
            Run now
          </Button>
          <Button variant="primary" size="sm" leading={<Send size={13} />}>
            Enqueue
          </Button>
        </div>

        {showToast && decision ? <DecisionToast decision={decision} /> : null}
      </section>
    </div>
  )
}

export function MockWorkflowAutoPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  return (
    <div className="min-h-screen overflow-auto bg-[var(--color-background)] p-8 text-[var(--color-text)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-[var(--color-text-strong)]">
            Workflow Auto mode — design mock
          </h1>
          <p className="text-sm text-[var(--color-muted-strong)]">
            Static preview for design review. Spec: planetz-workflow-auto-mode-design-2026-05-29 §6.
            Toggle Auto on each card to compare states (no real routing).
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <AddTaskCard
            caption="1. Auto ON · initial (no decision yet)"
            autoMode
            decision={null}
            placeholder
          />
          <AddTaskCard
            caption="2. Auto ON · after submit (high confidence)"
            autoMode
            decision={DECISION_HIGH}
            showDetail
            showToast
          />
          <AddTaskCard
            caption="3. Auto ON · low confidence → fallback"
            autoMode
            decision={DECISION_LOW}
            showDetail
            showToast
          />
          <AddTaskCard
            caption="4. Auto OFF · manual selection"
            autoMode={false}
            decision={DECISION_HIGH}
          />
        </div>

        <footer className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 p-3 text-xs text-[var(--color-muted-strong)]">
          <p className="mb-1 font-medium text-[var(--color-text)]">Notes</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              Auto=ON: workflow combobox is read-only; label = last decision or “Auto” placeholder.
            </li>
            <li>
              After submit: toast “Auto: group → workflow (confidence)”, plus collapsible detail.
            </li>
            <li>
              Low confidence: deterministic fallback (default → general → name order), shown
              explicitly.
            </li>
            <li>Auto=OFF: combobox interactive, classic manual flow.</li>
          </ul>
        </footer>
      </div>
    </div>
  )
}
