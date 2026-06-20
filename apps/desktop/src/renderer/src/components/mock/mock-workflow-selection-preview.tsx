import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  FileEdit,
  FlaskConical,
  Info,
  Loader2,
  Lock,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  SquarePen,
  Waypoints,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'

/**
 * Design mock for the "Workflow selection UX" proposals
 * (docs/issues/planetz-workflow-selection-ux-analysis-2026-06-10.md §6).
 *
 * Static, self-contained preview for design review only — no IPC, no store,
 * no real routing. Open at `#mock/workflow-selection`.
 *
 * Covers:
 *  §6.1 Workflow Preview popover (hover on combobox items)
 *  §6.2 Auto Decision Preview (chip states + breakdown popover + Run label)
 *  §6.3 Run-scoped Override (step skip / model override, modified state)
 *  §6.4 Queue decision badges + in-queue swap
 *  §6.5 Low-confidence confirm gate
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type ChangeMode = 'read_only' | 'mixed' | 'edit_heavy'

interface MockStep {
  name: string
  edit: boolean
  persona?: string
  /** Step can be skipped per-run (§6.3). */
  optional: boolean
  model?: string
}

interface MockWorkflow {
  name: string
  source: 'project' | 'builtin'
  description: string
  changeMode: ChangeMode
  forcesTests: boolean
  hasReview: boolean
  dominantModes: string[]
  /** strict safety tier: no per-run overrides allowed (§6.3 guardrail). */
  strict: boolean
  steps: MockStep[]
  lastRunAt: string
  successCount: number
  failCount: number
}

const WORKFLOWS: MockWorkflow[] = [
  {
    name: 'minimal',
    source: 'project',
    description: '最小構成。計画なしで実装し、簡易チェックのみで完了します。',
    changeMode: 'mixed',
    forcesTests: false,
    hasReview: false,
    dominantModes: ['implement'],
    strict: false,
    steps: [
      { name: 'understand', edit: false, persona: 'planner', optional: false },
      { name: 'implement', edit: true, persona: 'coder', optional: false },
      { name: 'self_check', edit: false, persona: 'coder', optional: true },
    ],
    lastRunAt: '2026-06-09',
    successCount: 31,
    failCount: 4,
  },
  {
    name: 'implement-with-review',
    source: 'project',
    description: '調査→計画→実装→レビューを行い、PR 可能なコード変更とレビュー所見を出力します。',
    changeMode: 'edit_heavy',
    forcesTests: true,
    hasReview: true,
    dominantModes: ['implement', 'review'],
    strict: false,
    steps: [
      { name: 'investigate', edit: false, persona: 'researcher', optional: false },
      { name: 'plan', edit: false, persona: 'planner', optional: false },
      { name: 'implement', edit: true, persona: 'coder', optional: false },
      { name: 'write_tests', edit: true, persona: 'coder', optional: true },
      { name: 'peer_review', edit: false, persona: 'reviewer', optional: true },
    ],
    lastRunAt: '2026-06-08',
    successCount: 12,
    failCount: 1,
  },
  {
    name: 'investigate-report',
    source: 'builtin',
    description: 'コードを変更せず調査のみ行い、根本原因と推奨対応のレポートを出力します。',
    changeMode: 'read_only',
    forcesTests: false,
    hasReview: false,
    dominantModes: ['investigate'],
    strict: false,
    steps: [
      { name: 'investigate', edit: false, persona: 'researcher', optional: false },
      { name: 'root_cause', edit: false, persona: 'researcher', optional: false },
      { name: 'report', edit: false, persona: 'writer', optional: false },
    ],
    lastRunAt: '2026-06-05',
    successCount: 9,
    failCount: 0,
  },
  {
    name: 'security-audit',
    source: 'builtin',
    description: 'セキュリティ監査専用。全 step が必須で、構成の変更はできません。',
    changeMode: 'read_only',
    forcesTests: false,
    hasReview: true,
    dominantModes: ['audit'],
    strict: true,
    steps: [
      { name: 'threat_model', edit: false, persona: 'auditor', optional: false },
      { name: 'audit', edit: false, persona: 'auditor', optional: false },
      { name: 'findings_review', edit: false, persona: 'reviewer', optional: false },
    ],
    lastRunAt: '2026-05-28',
    successCount: 3,
    failCount: 0,
  },
]

const MODEL_OPTIONS = ['(default)', 'opus-4-8', 'sonnet-4-6', 'haiku-4-5']

function findWorkflow(name: string): MockWorkflow {
  const wf = WORKFLOWS.find((w) => w.name === name)
  if (!wf) throw new Error(`mock workflow not found: ${name}`)
  return wf
}

// ---------------------------------------------------------------------------
// §6.3 run-scoped override state
// ---------------------------------------------------------------------------

interface StepOverride {
  skipped: boolean
  model: string
}

type OverrideMap = Record<string, StepOverride>

function emptyOverrides(wf: MockWorkflow): OverrideMap {
  const map: OverrideMap = {}
  for (const s of wf.steps) map[s.name] = { skipped: false, model: '(default)' }
  return map
}

function hasOverrides(map: OverrideMap): boolean {
  return Object.values(map).some((o) => o.skipped || o.model !== '(default)')
}

// ---------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------

const CHANGE_MODE_BADGE: Record<ChangeMode, { label: string; cls: string }> = {
  read_only: {
    label: 'read-only',
    cls: 'bg-[var(--color-surface)] text-[var(--color-muted-strong)] border border-[var(--color-border-strong)]',
  },
  mixed: {
    label: 'mixed',
    cls: 'bg-[var(--color-status-warn,#b45309)]/15 text-[var(--color-status-warn,#d97706)]',
  },
  edit_heavy: {
    label: 'edit-heavy',
    cls: 'bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]',
  },
}

function FeatureBadges({ wf }: { wf: MockWorkflow }) {
  const mode = CHANGE_MODE_BADGE[wf.changeMode]
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold',
          mode.cls,
        )}
      >
        <FileEdit size={10} />
        {mode.label}
      </span>
      {wf.forcesTests ? (
        <span className="inline-flex items-center gap-1 rounded bg-[var(--color-accent-soft)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-accent)]">
          <FlaskConical size={10} />
          tests必須
        </span>
      ) : null}
      {wf.hasReview ? (
        <span className="inline-flex items-center gap-1 rounded bg-[var(--color-accent-soft)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-accent)]">
          <Eye size={10} />
          review有り
        </span>
      ) : null}
      {wf.strict ? (
        <span className="inline-flex items-center gap-1 rounded bg-[var(--color-surface)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-muted-strong)]">
          <Lock size={10} />
          strict
        </span>
      ) : null}
      <span className="inline-flex items-center rounded bg-[var(--color-surface)] px-1.5 py-px text-[10px] text-[var(--color-muted)]">
        modes: {wf.dominantModes.join('+')}
      </span>
    </div>
  )
}

function StepMarker({ edit }: { edit: boolean }) {
  return edit ? (
    <span
      title="edit step（コードを変更します）"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]"
    >
      <SquarePen size={10} />
    </span>
  ) : (
    <span
      title="read-only step"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--color-surface)] text-[var(--color-muted)]"
    >
      <Search size={10} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// §6.1 Workflow preview popover (+ §6.3 override mode)
// ---------------------------------------------------------------------------

function WorkflowPreviewPanel({
  wf,
  mode,
  overrides,
  onOverridesChange,
  onEnterOverride,
  onApply,
  onReset,
}: {
  wf: MockWorkflow
  mode: 'view' | 'override'
  overrides: OverrideMap
  onOverridesChange: (next: OverrideMap) => void
  onEnterOverride: () => void
  onApply: () => void
  onReset: () => void
}) {
  const skippedSteps = wf.steps.filter((s) => overrides[s.name]?.skipped)
  const dirty = hasOverrides(overrides)

  return (
    <div className="flex w-96 shrink-0 flex-col gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Waypoints size={13} className="shrink-0 text-[var(--color-accent)]" />
          <span className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
            {wf.name}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">({wf.source})</span>
        </div>
        {mode === 'view' ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            preview
          </span>
        ) : (
          <span className="shrink-0 rounded bg-[var(--color-accent-soft)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-accent)]">
            このタスクのみ調整
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-muted-strong)]">{wf.description}</p>

      <FeatureBadges wf={wf} />

      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Steps ({wf.steps.length})
        </p>
        <ol className="flex flex-col">
          {wf.steps.map((step, i) => {
            const ov = overrides[step.name] ?? { skipped: false, model: '(default)' }
            const lockable = !step.optional || wf.strict
            return (
              <li
                key={step.name}
                className={cn(
                  'flex items-center gap-2 rounded px-1.5 py-1',
                  ov.skipped && 'opacity-45',
                )}
              >
                <span className="w-3 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
                  {i + 1}
                </span>
                <StepMarker edit={step.edit} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-mono text-[12px]',
                    ov.skipped
                      ? 'text-[var(--color-muted)] line-through'
                      : 'text-[var(--color-text)]',
                  )}
                >
                  {step.name}
                </span>
                {mode === 'view' ? (
                  <>
                    {step.persona ? (
                      <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
                        {step.persona}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                      {step.edit ? 'edit' : 'read-only'}
                    </span>
                  </>
                ) : (
                  <>
                    <select
                      aria-label={`${step.name} model`}
                      disabled={ov.skipped || wf.strict}
                      value={ov.model}
                      onChange={(e) =>
                        onOverridesChange({
                          ...overrides,
                          [step.name]: { ...ov, model: e.target.value },
                        })
                      }
                      className="h-6 shrink-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-1 text-[10px] text-[var(--color-text)] disabled:opacity-50"
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {lockable ? (
                      <span
                        title={wf.strict ? 'strict tier: 変更不可' : '必須 step'}
                        className="inline-flex h-6 w-12 shrink-0 items-center justify-center gap-1 rounded text-[10px] text-[var(--color-muted)]"
                      >
                        <Lock size={10} />
                        必須
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onOverridesChange({
                            ...overrides,
                            [step.name]: { ...ov, skipped: !ov.skipped },
                          })
                        }
                        className={cn(
                          'inline-flex h-6 w-12 shrink-0 items-center justify-center gap-1 rounded border text-[10px] font-medium transition-colors',
                          ov.skipped
                            ? 'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed)]/10 text-[var(--color-status-failed)]'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]',
                        )}
                      >
                        {ov.skipped ? (
                          <>
                            <X size={10} /> skip
                          </>
                        ) : (
                          <>
                            <Check size={10} /> 実行
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {mode === 'override' && skippedSteps.length > 0 ? (
        <div className="flex items-start gap-1.5 rounded bg-[var(--color-status-failed)]/10 px-2 py-1.5 text-[11px] text-[var(--color-status-failed)]">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          <span>
            {skippedSteps.map((s) => s.name).join(', ')} を skip します（このタスクのみ。workflow
            定義は変更されません）
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'border-t border-[var(--color-border)] pt-2',
          mode === 'view' ? 'flex flex-col gap-1.5' : 'flex items-center justify-between gap-2',
        )}
      >
        {mode === 'view' ? (
          <>
            <span className="text-[10px] text-[var(--color-muted)]">
              最終実行 {wf.lastRunAt} · 成功 {wf.successCount} / 失敗 {wf.failCount}
            </span>
            <div className="flex items-center justify-end gap-1">
              {!wf.strict ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leading={<Pencil size={11} />}
                  onClick={onEnterOverride}
                >
                  このタスクのみ調整
                </Button>
              ) : null}
              <Button variant="ghost" size="sm">
                Settings で編集 ↗
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" leading={<RotateCcw size={11} />} onClick={onReset}>
              リセット
            </Button>
            <Button variant="primary" size="sm" disabled={!dirty} onClick={onApply}>
              適用してこの構成で実行
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual combobox with hover preview (§6.1)
// ---------------------------------------------------------------------------

function WorkflowComboWithPreview({
  value,
  modified,
  onSelect,
  onApplyOverrides,
}: {
  value: string
  modified: boolean
  onSelect: (name: string) => void
  onApplyOverrides: (name: string, overrides: OverrideMap) => void
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'override'>('view')
  const [overrides, setOverrides] = useState<OverrideMap>(() => emptyOverrides(findWorkflow(value)))

  const previewName = hovered ?? value
  const previewWf = findWorkflow(previewName)

  const openPreviewFor = (name: string) => {
    setHovered(name)
    setPanelMode('view')
    setOverrides(emptyOverrides(findWorkflow(name)))
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (!open) openPreviewFor(value)
          }}
          className="focus-ring flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-2 text-left text-sm text-[var(--color-text)]"
        >
          {modified ? (
            <span title="このタスク限定の調整あり" className="shrink-0 text-[var(--color-accent)]">
              ◈
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {value}
            {modified ? ' (modified)' : ''}
            <span className="ml-1 text-[var(--color-muted)]">({findWorkflow(value).source})</span>
          </span>
          <ChevronDown size={14} className="shrink-0 text-[var(--color-muted)]" />
        </button>
        <button
          type="button"
          title="選択中 workflow のプレビュー"
          onClick={() => {
            setOpen(true)
            openPreviewFor(value)
          }}
          className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          <Info size={14} />
        </button>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="閉じる"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
        />
      ) : null}
      {open ? (
        <div className="absolute left-0 top-9 z-20 flex items-start gap-2">
          <ul className="w-60 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] py-1 shadow-xl shadow-black/30">
            {WORKFLOWS.map((wf) => (
              <li key={wf.name}>
                <button
                  type="button"
                  onMouseEnter={() => openPreviewFor(wf.name)}
                  onFocus={() => openPreviewFor(wf.name)}
                  onClick={() => {
                    onSelect(wf.name)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
                    previewName === wf.name
                      ? 'bg-[var(--color-accent-soft)]/60 text-[var(--color-text-strong)]'
                      : 'text-[var(--color-text)]',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{wf.name}</span>
                  <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                    {wf.source}
                  </span>
                  {wf.name === value ? (
                    <Check size={12} className="shrink-0 text-[var(--color-accent)]" />
                  ) : null}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-[var(--color-border)] px-2.5 pb-0.5 pt-1.5 text-[10px] text-[var(--color-muted)]">
              項目にホバーで右にプレビュー表示
            </li>
          </ul>

          <WorkflowPreviewPanel
            wf={previewWf}
            mode={panelMode}
            overrides={overrides}
            onOverridesChange={setOverrides}
            onEnterOverride={() => setPanelMode('override')}
            onApply={() => {
              onApplyOverrides(previewWf.name, overrides)
              setOpen(false)
            }}
            onReset={() => setOverrides(emptyOverrides(previewWf))}
          />
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// §6.2 Auto decision chip + breakdown popover
// ---------------------------------------------------------------------------

type AutoState =
  | { kind: 'empty' }
  | { kind: 'computing' }
  | { kind: 'provisional'; workflow: string }
  | { kind: 'confirming'; workflow: string }
  | { kind: 'confirmed'; workflow: string; confidence: 'high' | 'low' }

interface AutoCandidate {
  name: string
  score: number
  rejected?: string
}

function mockRoute(prompt: string): { workflow: string; candidates: AutoCandidate[] } {
  const p = prompt.toLowerCase()
  const investigate =
    p.includes('調査') || p.includes('原因') || p.includes('investigate') || p.includes('why')
  const wantsReview = p.includes('レビュー') || p.includes('テスト') || p.includes('review')
  if (investigate && !wantsReview) {
    return {
      workflow: 'investigate-report',
      candidates: [
        { name: 'investigate-report', score: 0.78 },
        { name: 'minimal', score: 0.42 },
        {
          name: 'implement-with-review',
          score: 0,
          rejected: '調査のみのタスクに対し、全経路で実装が必須のため',
        },
      ],
    }
  }
  if (wantsReview) {
    return {
      workflow: 'implement-with-review',
      candidates: [
        { name: 'implement-with-review', score: 0.82 },
        { name: 'minimal', score: 0.61 },
        {
          name: 'investigate-report',
          score: 0,
          rejected: '実装が必要なのに read-only workflow のため',
        },
      ],
    }
  }
  return {
    workflow: 'minimal',
    candidates: [
      { name: 'minimal', score: 0.66 },
      { name: 'implement-with-review', score: 0.58 },
      { name: 'investigate-report', score: 0.31 },
    ],
  }
}

function AutoDecisionChip({
  state,
  expanded,
  onToggleExpand,
}: {
  state: AutoState
  expanded: boolean
  onToggleExpand: () => void
}) {
  const base =
    'flex h-8 w-full items-center gap-2 rounded-md border pl-2.5 pr-2 text-left text-sm select-none'

  if (state.kind === 'empty') {
    return (
      <div
        className={cn(
          base,
          'border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/60 text-[var(--color-muted)]',
        )}
      >
        <Zap size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">auto — プロンプト入力で予測します</span>
      </div>
    )
  }
  if (state.kind === 'computing') {
    return (
      <div
        className={cn(
          base,
          'border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/60 text-[var(--color-muted-strong)]',
        )}
      >
        <Loader2 size={13} className="shrink-0 animate-spin text-[var(--color-accent)]" />
        <span className="min-w-0 flex-1 truncate">auto — 予測中…</span>
      </div>
    )
  }

  const confirmed = state.kind === 'confirmed'
  return (
    <button
      type="button"
      onClick={onToggleExpand}
      aria-expanded={expanded}
      className={cn(
        base,
        'focus-ring transition-colors',
        confirmed
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50 text-[var(--color-text)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]',
      )}
    >
      <Zap
        size={13}
        className={cn(
          'shrink-0',
          confirmed ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]',
        )}
      />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-[var(--color-muted)]">auto → </span>
        <span className={cn('font-medium', confirmed && 'text-[var(--color-accent)]')}>
          {state.workflow}
        </span>{' '}
        {state.kind === 'confirming' ? (
          <Loader2 size={11} className="inline animate-spin text-[var(--color-accent)]" />
        ) : confirmed ? (
          <Check size={12} className="inline text-[var(--color-status-ok)]" />
        ) : (
          <span title="ルールベースの暫定予測（未確定）" className="text-[var(--color-muted)]">
            ?
          </span>
        )}
      </span>
      <ChevronDown
        size={14}
        className={cn(
          'shrink-0 text-[var(--color-muted)] transition-transform',
          expanded && 'rotate-180',
        )}
      />
    </button>
  )
}

function AutoDecisionPopover({
  state,
  candidates,
  onPin,
  onConfirm,
}: {
  state: AutoState
  candidates: AutoCandidate[]
  onPin: (name: string) => void
  onConfirm: () => void
}) {
  if (state.kind !== 'provisional' && state.kind !== 'confirmed' && state.kind !== 'confirming') {
    return null
  }
  const confirmed = state.kind === 'confirmed'
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-xl shadow-black/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-text-strong)]">Auto 予測の内訳</p>
        <span
          className={cn(
            'rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
            confirmed
              ? 'bg-[var(--color-status-ok)]/15 text-[var(--color-status-ok)]'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)]',
          )}
        >
          {confirmed ? `LLM 確定 · ${state.confidence}` : 'ルールベース · 未確定'}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          タスクから読み取った要件
        </p>
        <div className="flex flex-wrap gap-1">
          {['実装を伴う', 'テスト言及あり', '曖昧さ: 低'].map((req) => (
            <span
              key={req}
              className="rounded bg-[var(--color-surface)] px-1.5 py-px text-[10px] text-[var(--color-muted-strong)]"
            >
              {req}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          候補
        </p>
        <ul className="flex flex-col gap-0.5">
          {candidates.map((c, i) => {
            const isTop = i === 0 && !c.rejected
            return (
              <li key={c.name} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    'mt-0.5 shrink-0',
                    c.rejected
                      ? 'text-[var(--color-status-failed)]'
                      : isTop
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-muted)]',
                  )}
                >
                  {c.rejected ? '✕' : isTop ? '●' : '○'}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 font-mono',
                    c.rejected
                      ? 'text-[var(--color-muted)] line-through'
                      : 'text-[var(--color-text)]',
                  )}
                >
                  {c.name}
                </span>
                {c.rejected ? (
                  <span className="max-w-44 shrink-0 text-right text-[10px] leading-tight text-[var(--color-status-failed)]/90">
                    除外: {c.rejected}
                  </span>
                ) : (
                  <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                    score {c.score.toFixed(2)}
                    {isTop ? ' ← 1位' : ''}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-[var(--color-border)] pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPin(state.workflow)}
          title="Auto を OFF にせず、この enqueue のみ手動選択に切り替えます"
        >
          この workflow に固定する
        </Button>
        {!confirmed ? (
          <Button
            variant="subtle"
            size="sm"
            leading={<Sparkles size={11} />}
            loading={state.kind === 'confirming'}
            onClick={onConfirm}
          >
            LLM で確定する
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Integrated composer demo (§6.1–6.3)
// ---------------------------------------------------------------------------

function ComposerDemo({ onEnqueue }: { onEnqueue: (label: string, kind: QueueKind) => void }) {
  const [auto, setAuto] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [autoState, setAutoState] = useState<AutoState>({ kind: 'empty' })
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [manualValue, setManualValue] = useState('minimal')
  const [modified, setModified] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const route = useMemo(() => mockRoute(prompt), [prompt])

  // §6.2 B-1: debounce → deterministic provisional prediction (no LLM).
  useEffect(() => {
    if (!auto) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (prompt.trim().length < 8) {
      setAutoState({ kind: 'empty' })
      setPopoverOpen(false)
      return
    }
    setAutoState({ kind: 'computing' })
    debounceRef.current = setTimeout(() => {
      setAutoState({ kind: 'provisional', workflow: mockRoute(prompt).workflow })
    }, 700)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [prompt, auto])

  const confirm = () => {
    if (autoState.kind !== 'provisional') return
    setAutoState({ kind: 'confirming', workflow: autoState.workflow })
    setTimeout(() => {
      setAutoState({ kind: 'confirmed', workflow: route.workflow, confidence: 'high' })
    }, 900)
  }

  const runLabel =
    auto && (autoState.kind === 'provisional' || autoState.kind === 'confirming')
      ? `${autoState.workflow} ?`
      : auto && autoState.kind === 'confirmed'
        ? autoState.workflow
        : auto
          ? 'auto'
          : `${manualValue}${modified ? ' (modified)' : ''}`

  return (
    // z-30: backdrop-blur creates a stacking context; lift it above the queue section so popovers paint on top
    <section className="relative z-30 flex flex-col gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Add Task</h3>
        <span className="text-[10px] text-[var(--color-muted)]">
          プロンプト例: 「ログインバグの原因を調査して」「リセット導線を実装してテストも書いて」
        </span>
      </div>

      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="タスクを入力（8文字以上で Auto 予測が動きます）"
        className="w-full resize-none rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none"
      />

      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Workflow <span className="text-[var(--color-status-failed)]">*</span>
        </p>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {auto ? (
              <div className="flex flex-col gap-1.5">
                <AutoDecisionChip
                  state={autoState}
                  expanded={popoverOpen}
                  onToggleExpand={() => setPopoverOpen((v) => !v)}
                />
                {popoverOpen ? (
                  <AutoDecisionPopover
                    state={autoState}
                    candidates={route.candidates}
                    onPin={(name) => {
                      setAuto(false)
                      setManualValue(name)
                      setModified(false)
                      setPopoverOpen(false)
                    }}
                    onConfirm={confirm}
                  />
                ) : null}
              </div>
            ) : (
              <WorkflowComboWithPreview
                value={manualValue}
                modified={modified}
                onSelect={(name) => {
                  setManualValue(name)
                  setModified(false)
                }}
                onApplyOverrides={(name) => {
                  setManualValue(name)
                  setModified(true)
                }}
              />
            )}
          </div>
          <AutoToggleReplica
            on={auto}
            onChange={(next) => {
              setAuto(next)
              setPopoverOpen(false)
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" leading={<Sparkles size={12} />}>
          Refine in Composer
        </Button>
        {/* §6.2 B-3: Run button always names what will run. */}
        <Button
          variant="primary"
          size="md"
          leading={<Play size={13} />}
          onClick={() =>
            onEnqueue(
              prompt.trim() || '（無題タスク）',
              auto ? 'auto' : modified ? 'modified' : 'manual',
            )
          }
        >
          Run single
          <span className="ml-1 max-w-44 truncate font-normal opacity-80">— {runLabel}</span>
        </Button>
      </div>
    </section>
  )
}

/** Same toggle as composer-workflow-auto.tsx, replicated to keep the mock self-contained. */
function AutoToggleReplica({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto workflow"
      onClick={() => onChange(!on)}
      className={cn(
        'focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
        on ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted-strong)]',
      )}
    >
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

// ---------------------------------------------------------------------------
// §6.4 queue cards with decision badges
// ---------------------------------------------------------------------------

type QueueKind = 'auto' | 'modified' | 'manual'

interface QueueItem {
  id: number
  title: string
  workflow: string
  kind: QueueKind
  status: 'queued' | 'running'
  stepProgress?: string
}

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: 20,
    title: 'Provider モデル候補のライブ取得',
    workflow: 'implement-with-review',
    kind: 'auto',
    status: 'queued',
  },
  {
    id: 19,
    title: 'LEGACY_COUNTER_PACK_SKIN_ID mismatch',
    workflow: 'minimal',
    kind: 'modified',
    status: 'queued',
  },
  {
    id: 17,
    title: 'Empty header flex slot when Manta mode disabled',
    workflow: 'minimal',
    kind: 'manual',
    status: 'running',
    stepProgress: 'step 2/3 · implement',
  },
]

function QueueBadge({ kind }: { kind: QueueKind }) {
  if (kind === 'auto') {
    return (
      <span
        title="Auto 決定（クリックで内訳）"
        className="inline-flex items-center gap-0.5 rounded bg-[var(--color-accent-soft)] px-1 py-px text-[10px] font-semibold text-[var(--color-accent)]"
      >
        <Zap size={9} />
        auto
      </span>
    )
  }
  if (kind === 'modified') {
    return (
      <span
        title="このタスク限定の調整あり"
        className="inline-flex items-center gap-0.5 rounded bg-[var(--color-surface)] px-1 py-px text-[10px] font-semibold text-[var(--color-accent)]"
      >
        ◈ modified
      </span>
    )
  }
  return null
}

function QueueSection({
  items,
  onSwap,
}: {
  items: QueueItem[]
  onSwap: (id: number, wf: string) => void
}) {
  const [swapFor, setSwapFor] = useState<number | null>(null)
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Queue</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="relative flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-2.5 py-2"
          >
            <p className="truncate text-sm text-[var(--color-text)]">
              <span className="text-[var(--color-muted)]">#{item.id}</span> {item.title}
            </p>
            <div className="flex items-center gap-1.5 text-[11px]">
              <QueueBadge kind={item.kind} />
              <span className="font-mono text-[var(--color-muted-strong)]">
                {item.workflow}
                {item.kind === 'modified' ? ' (modified)' : ''}
              </span>
              <span className="text-[var(--color-muted)]">·</span>
              {item.status === 'queued' ? (
                <span className="text-[var(--color-muted)]">queued</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
                  <Loader2 size={10} className="animate-spin" />
                  running · {item.stepProgress}
                </span>
              )}
              {/* §6.4: swap only while queued */}
              {item.status === 'queued' ? (
                <button
                  type="button"
                  onClick={() => setSwapFor((v) => (v === item.id ? null : item.id))}
                  className="focus-ring ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-muted-strong)] hover:text-[var(--color-text)]"
                >
                  変更 <ChevronDown size={10} />
                </button>
              ) : (
                <span className="ml-auto text-[10px] text-[var(--color-muted)]/60">変更不可</span>
              )}
            </div>
            {swapFor === item.id ? (
              <ul className="absolute right-2 top-full z-10 mt-1 w-56 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] py-1 shadow-xl shadow-black/30">
                {WORKFLOWS.filter((w) => !w.strict).map((wf) => (
                  <li key={wf.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSwap(item.id, wf.name)
                        setSwapFor(null)
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]/50"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono">{wf.name}</span>
                      {wf.name === item.workflow ? (
                        <Check size={11} className="text-[var(--color-accent)]" />
                      ) : null}
                    </button>
                  </li>
                ))}
                <li className="border-t border-[var(--color-border)] px-2.5 pb-0.5 pt-1 text-[10px] text-[var(--color-muted)]">
                  差し替えは audit に記録されます
                </li>
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// §6.5 low-confidence confirm gate
// ---------------------------------------------------------------------------

function LowConfidenceDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: (picked?: string) => void
}) {
  if (!open) return null
  const candidates = [
    {
      name: 'investigate-report',
      blurb: '調査のみ・コード変更なし',
      wf: findWorkflow('investigate-report'),
    },
    { name: 'minimal', blurb: '最小構成で実装まで行う', wf: findWorkflow('minimal') },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-status-failed)]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">
              Auto の確信度が低いタスクです
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-muted-strong)]">
              "LEGACY_COUNTER_PACK_SKIN_ID mismatch with AvailableSkinId validation"
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="focus-ring ml-auto shrink-0 rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-[var(--color-muted-strong)]">どちらで実行しますか？</p>
        <div className="grid grid-cols-2 gap-2">
          {candidates.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onClose(c.name)}
              className="focus-ring flex flex-col gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-2.5 text-left transition-colors hover:border-[var(--color-accent)]"
            >
              <span className="font-mono text-sm text-[var(--color-text-strong)]">{c.name}</span>
              <span className="text-[11px] leading-snug text-[var(--color-muted-strong)]">
                {c.blurb}
              </span>
              <FeatureBadges wf={c.wf} />
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <input type="checkbox" className="accent-[var(--color-accent)]" />
          今後このペアでは聞かない
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MockWorkflowSelectionPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE)
  const [gateOpen, setGateOpen] = useState(false)

  return (
    <div className="min-h-screen overflow-auto bg-[var(--color-background)] p-8 text-[var(--color-text)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-40">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-[var(--color-text-strong)]">
            Workflow selection UX — design mock
          </h1>
          <p className="text-sm text-[var(--color-muted-strong)]">
            Static preview for design review. Spec:
            planetz-workflow-selection-ux-analysis-2026-06-10 §6. No real routing / IPC.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <SectionCaption
            no="1"
            title="統合デモ — Composer（§6.1 Preview / §6.2 Auto 予測 / §6.3 Override）"
            hint="Auto ON: プロンプト入力 → 暫定予測 → チップ展開で内訳 →「LLM で確定」。Auto OFF: セレクタ展開 → 項目ホバーでプレビュー →「このタスクのみ調整」で step skip / model 変更。"
          />
          <ComposerDemo
            onEnqueue={(title, kind) =>
              setQueue((q) => [
                {
                  id: Math.max(...q.map((i) => i.id)) + 1,
                  title,
                  workflow: kind === 'auto' ? 'implement-with-review' : 'minimal',
                  kind,
                  status: 'queued',
                },
                ...q,
              ])
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <SectionCaption
            no="2"
            title="Queue decision badge + 差し替え（§6.4）"
            hint="⚡=Auto 決定 / ◈=run-scoped 調整あり / 無印=手動。queued の間のみ [変更] で workflow を差し替え可能。Composer の Run single でここに追加されます。"
          />
          <QueueSection
            items={queue}
            onSwap={(id, wf) =>
              setQueue((q) =>
                q.map((item) =>
                  item.id === id ? { ...item, workflow: wf, kind: 'manual' } : item,
                ),
              )
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <SectionCaption
            no="3"
            title="低 confidence 確認ゲート（§6.5・オプトイン設定）"
            hint="Auto の final 比較が confidence: low の場合のみ、enqueue 前に 1 クリックで候補を選ばせる割り込みダイアログ。"
          />
          <div>
            <Button variant="secondary" size="sm" onClick={() => setGateOpen(true)}>
              ダイアログを表示
            </Button>
          </div>
        </div>

        <footer className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 p-3 text-xs text-[var(--color-muted-strong)]">
          <p className="mb-1 font-medium text-[var(--color-text)]">Notes</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>暫定予測（?）はルールベースのみ・LLM 呼び出しゼロ。確定（✓）で LLM 比較を実行。</li>
            <li>step マーカー: 赤ペン = edit step（コード変更あり）、灰虫眼鏡 = read-only。</li>
            <li>
              override は必須 step / strict tier では不可（鍵アイコン）。適用すると ◈ (modified)
              表示になり、workflow 定義自体は変更されない。
            </li>
            <li>
              security-audit は strict tier の例。プレビューに「このタスクのみ調整」が出ない。
            </li>
          </ul>
        </footer>
      </div>

      <LowConfidenceDialog open={gateOpen} onClose={() => setGateOpen(false)} />
    </div>
  )
}

function SectionCaption({ no, title, hint }: { no: string; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {no}. {title}
      </p>
      <p className="text-[11px] text-[var(--color-muted)]/80">{hint}</p>
    </div>
  )
}
