import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  GitBranch,
  Hash,
  Maximize2,
  RefreshCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { PanelShell } from '../panel-shell'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Dialog } from '../ui/dialog'
import { StatusDot } from '../ui/status-dot'

// ---------------------------------------------------------------------------
// Mock data types (parallel to the proposed TaskResultBundle in the design doc)
// ---------------------------------------------------------------------------

interface MockReport {
  fileName: string
  stepName: string
  formatKey: string
  content: string
}

type ResultStatus = 'ok' | 'no_reports' | 'external' | 'no_run' | 'error'

interface MockScenario {
  id: string
  title: string
  description: string
  taskTitle: string
  taskId: string
  orderBody: string
  branch?: string
  runId?: string
  status: ResultStatus
  reports: MockReport[]
  primaryIndex: number
  taskStatus: 'completed' | 'failed'
  failureMessage?: string
}

const SCENARIOS: MockScenario[] = [
  {
    id: 'ok-single',
    title: 'Single summary — quick Q&A (S1)',
    description:
      'Most common shape: one summary report. Detail jumps straight to the answer; no dots.',
    taskTitle: 'git workflow question',
    taskId: 't_abc123',
    orderBody:
      'git は使えるか? 現在のブランチで commit / push 可能か確認したい。pre-commit や remote の状態も知りたい。',
    branch: 'feature/git-check',
    runId: 'run-2026-05-29-1432-001',
    status: 'ok',
    primaryIndex: 0,
    taskStatus: 'completed',
    reports: [
      {
        fileName: 'summary.md',
        stepName: 'verify',
        formatKey: 'summary',
        content: `# Summary

**Yes**, this branch is ready to use git.

- ✅ \`pre-commit\` hook is installed and runs lint + typecheck
- ✅ Remote is configured for \`origin/main\`
- ✅ Working tree is clean (no uncommitted changes detected)
- ℹ️ Last commit: \`410cdbc mod\` (HEAD)

## Recommended next actions

1. Stage the changes you want to ship: \`git add <paths>\`
2. Commit with a descriptive message
3. Push with \`git push origin HEAD\`

No blockers found.`,
      },
    ],
  },
  {
    id: 'ok-multi',
    title: 'Multiple reports — plan / implement / review (S3)',
    description:
      '3-step workflow produced 3 reports. Dots show siblings; full view exposes all tabs.',
    taskTitle: 'Implement auth core',
    taskId: 't_def456',
    orderBody:
      'src/auth 配下に session-based auth を実装してほしい。既存の express 設定との互換性を保つこと。',
    branch: 'feature/auth-core',
    runId: 'run-2026-05-29-1351-009',
    status: 'ok',
    primaryIndex: 1,
    taskStatus: 'completed',
    reports: [
      {
        fileName: 'plan.md',
        stepName: 'plan',
        formatKey: 'plan',
        content: `# Plan

## Goal
Add session-based authentication under \`src/auth/\`.

## Steps
1. Introduce \`SessionStore\` interface (memory + redis adapters)
2. Wire \`express-session\` middleware in \`server.ts\`
3. Add \`/login\` and \`/logout\` routes
4. Cover with integration tests against the real redis test container`,
      },
      {
        fileName: 'summary.md',
        stepName: 'implement',
        formatKey: 'summary',
        content: `# Summary

Implemented session-based auth core. All planned steps completed.

## Changed files
- \`src/auth/session-store.ts\` (new) — \`SessionStore\` interface + memory adapter
- \`src/auth/redis-session-store.ts\` (new) — Redis adapter
- \`src/server.ts\` — wired \`express-session\` middleware
- \`src/routes/auth.ts\` (new) — \`/login\` and \`/logout\`
- \`src/__tests__/auth.integration.test.ts\` (new) — 8 tests passing

## Test results
\`pnpm test --filter @app/auth\` → **8 passed**, 0 failed (2.1s)

## Follow-ups
- CSRF protection deferred to follow-up ticket
- Session TTL hard-coded to 24h — consider config`,
      },
      {
        fileName: 'qa-review.md',
        stepName: 'review',
        formatKey: 'qa_review',
        content: `# QA Review

## Verdict: **approve with notes**

### Strengths
- Clean separation between interface and adapters
- Integration tests hit a real redis container — good signal

### Notes
- \`SessionStore.touch()\` could be merged into \`get()\` to reduce round-trips
- Magic number \`24h\` should be promoted to \`config/session.ts\`

### Risk
Low. Memory adapter is dev-only; redis adapter is the production path.`,
      },
    ],
  },
  {
    id: 'no-reports',
    title: 'No reports — workflow ran but produced nothing (S7 variant)',
    description:
      'Run dir exists but reports/ is empty. Section header stays; body explains + offers Log.',
    taskTitle: 'Refactor invoice service',
    taskId: 't_ghi789',
    orderBody: '請求書サービスの責務を分離してほしい。',
    branch: 'refactor/invoice-svc',
    runId: 'run-2026-05-29-1102-003',
    status: 'no_reports',
    primaryIndex: -1,
    taskStatus: 'completed',
    reports: [],
  },
  {
    id: 'external',
    title: 'External executor — Cursor adapter (S7)',
    description:
      'agent-external-cursor: no facet result. Section is hidden; explanatory note replaces it.',
    taskTitle: 'Audit external cursor integration',
    taskId: 't_jkl012',
    orderBody: 'cursor 経由で実行した結果が Planetz から見えるか確認したい。',
    branch: 'audit/cursor',
    status: 'external',
    primaryIndex: -1,
    taskStatus: 'completed',
    reports: [],
  },
  {
    id: 'failed-partial',
    title: 'Failed with partial report (S5)',
    description: 'Failure panel stays on top. Partial result is shown below with a warning frame.',
    taskTitle: 'Migrate billing pipeline',
    taskId: 't_mno345',
    orderBody: 'billing パイプラインを新スキーマに移行。',
    branch: 'feature/billing-migration',
    runId: 'run-2026-05-29-0922-014',
    status: 'ok',
    primaryIndex: 0,
    taskStatus: 'failed',
    failureMessage:
      'Step `migrate` exceeded the 600s budget. Partial plan was written before the abort.',
    reports: [
      {
        fileName: 'plan.md',
        stepName: 'plan',
        formatKey: 'plan',
        content: `# Plan (partial)

## Goal
Migrate billing tables to v2 schema with zero downtime.

## Steps
1. Add v2 columns alongside v1 (backfill nullable)
2. Dual-write from app
3. Backfill historical rows in batches of 10k
4. Cut reads over to v2
5. Drop v1 columns

> Phase 2 (implement) did not write its report — the run aborted while executing step 3.`,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export function MockResultDisplayPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-strong)]">
            UI Mock · planetz
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
            Task Result display — Detail / Full view / Done card
          </h1>
          <p className="mt-1 max-w-3xl text-[12px] text-[var(--color-muted-strong)]">
            Mock for{' '}
            <span className="font-mono">planetz-task-result-display-ux-design-2026-05-29.md</span>.
            Reuses production <span className="font-mono">PanelShell</span>,{' '}
            <span className="font-mono">Badge</span>, <span className="font-mono">Button</span>,{' '}
            <span className="font-mono">Dialog</span>. Append{' '}
            <span className="font-mono">#mock/result-display</span> to the URL.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {SCENARIOS.map((scenario) => (
          <ScenarioSection key={scenario.id} scenario={scenario} />
        ))}
      </main>
    </div>
  )
}

function ScenarioSection({ scenario }: { scenario: MockScenario }) {
  const [fullViewIndex, setFullViewIndex] = useState<number | null>(null)

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/50 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">
            {scenario.title}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted-strong)]">
            {scenario.description}
          </p>
        </div>
        <Badge tone="accent">{scenario.id}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div>
          <SectionLabel>Detail panel</SectionLabel>
          <MockDetailPanel scenario={scenario} onOpenFull={(idx) => setFullViewIndex(idx)} />
        </div>
        <div className="space-y-4">
          <div>
            <SectionLabel>Done lane · task card</SectionLabel>
            <MockDoneCard scenario={scenario} />
          </div>
        </div>
      </div>

      {fullViewIndex !== null ? (
        <ResultFullView
          scenario={scenario}
          initialIndex={fullViewIndex}
          onClose={() => setFullViewIndex(null)}
        />
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Detail panel mock (mirrors detail-panel.tsx shape, adds Result section)
// ---------------------------------------------------------------------------

function MockDetailPanel({
  scenario,
  onOpenFull,
}: {
  scenario: MockScenario
  onOpenFull: (reportIndex: number) => void
}) {
  const isCompleted = scenario.taskStatus === 'completed'
  const isFailed = scenario.taskStatus === 'failed'
  const hasReports = scenario.reports.length > 0

  return (
    <PanelShell
      title="Detail"
      subtitle={scenario.taskTitle}
      actions={
        <>
          <Button type="button" variant="ghost" size="sm" leading={<ArrowLeft size={12} />}>
            Back
          </Button>
          <button
            type="button"
            aria-label="Expand detail"
            className="inline-flex size-6 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
          >
            <Maximize2 size={13} />
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={isFailed ? 'failed' : 'completed'}
            leading={<StatusDot tone={isFailed ? 'failed' : 'completed'} />}
          >
            {isFailed ? 'failed' : 'completed'}
          </Badge>
          <Badge tone="neutral">P2</Badge>
          <Badge tone="accent">agent-claude</Badge>
        </div>

        {/* Failure panel (mock) — only for failed scenario */}
        {isFailed && scenario.failureMessage ? (
          <div className="rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/30 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-status-failed)]">
              Failure
            </p>
            <p className="text-xs text-[var(--color-text)]">{scenario.failureMessage}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" leading={<RefreshCcw size={12} />}>
                Retry
              </Button>
              <Button type="button" variant="ghost" size="sm" leading={<ExternalLink size={12} />}>
                Open in Log
              </Button>
            </div>
          </div>
        ) : null}

        {/* === Result section — the headline of this mock ============== */}
        <ResultSection scenario={scenario} onOpenFull={onOpenFull} />

        {/* Order (input) — secondary now that Result is primary */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            order.md · 依頼
          </p>
          <pre className="max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-[var(--color-text)]">
            {scenario.orderBody}
          </pre>
        </div>

        {/* Metadata */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="flex items-center gap-1 text-[var(--color-muted)]">
            <Hash size={11} />
            id
          </dt>
          <dd className="font-mono text-[var(--color-text)]">{scenario.taskId}</dd>
          {scenario.runId ? (
            <>
              <dt className="text-[var(--color-muted)]">run</dt>
              <dd className="truncate font-mono text-[var(--color-muted-strong)]">
                {scenario.runId}
              </dd>
            </>
          ) : null}
          {scenario.branch ? (
            <>
              <dt className="flex items-center gap-1 text-[var(--color-muted)]">
                <GitBranch size={11} />
                branch
              </dt>
              <dd className="min-w-0 overflow-hidden font-mono text-[var(--color-text)]">
                <span className="inline-flex items-center gap-1">
                  {scenario.branch}
                  <ExternalLink size={10} className="text-[var(--color-muted)]" />
                </span>
              </dd>
            </>
          ) : null}
          <dt className="flex items-center gap-1 text-[var(--color-muted)]">
            <Clock size={11} />
            updated
          </dt>
          <dd className="text-[var(--color-text)]">14:32</dd>
        </dl>

        {isCompleted && hasReports ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            leading={<ExternalLink size={12} />}
          >
            Open in Log
          </Button>
        ) : null}

        {/* Conversation (collapsed mock) */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
            Conversation
          </p>
          <p className="text-xs text-[var(--color-muted)]">initial_order · 14:30</p>
        </div>
      </div>
    </PanelShell>
  )
}

// ---------------------------------------------------------------------------
// Result section — the new component proposed in the design
// ---------------------------------------------------------------------------

function ResultSection({
  scenario,
  onOpenFull,
}: {
  scenario: MockScenario
  onOpenFull: (reportIndex: number) => void
}) {
  const isFailed = scenario.taskStatus === 'failed'
  const primary = scenario.reports[scenario.primaryIndex]
  const reports = scenario.reports

  // status: 'external' → no Result section at all; render an inline note instead
  if (scenario.status === 'external') {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/40 p-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          結果 · Result
        </p>
        <p className="text-xs text-[var(--color-muted-strong)]">
          外部実行（Cursor 等）のため、構造化された Result はありません。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" leading={<FolderOpen size={12} />}>
            Open worktree
          </Button>
          <Button type="button" variant="ghost" size="sm" leading={<ExternalLink size={12} />}>
            Open in Log
          </Button>
        </div>
      </div>
    )
  }

  // no_reports
  if (scenario.status === 'no_reports' || reports.length === 0) {
    return (
      <ResultFrame title="Result" accent={false} actions={null}>
        <p className="text-xs text-[var(--color-muted-strong)]">
          このタスクは構造化レポートを出力しませんでした。実行ログから内容を確認できます。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" leading={<ExternalLink size={12} />}>
            Open in Log
          </Button>
        </div>
      </ResultFrame>
    )
  }

  // ok / failed-with-partial
  if (!primary) return null

  return (
    <ResultFrame
      title={`Result · ${primary.formatKey}`}
      accent={!isFailed}
      warning={isFailed}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leading={<Maximize2 size={11} />}
          onClick={() => onOpenFull(scenario.primaryIndex)}
        >
          Open full
        </Button>
      }
    >
      <div className="relative">
        <MarkdownPreview content={primary.content} maxLines={12} />
        {reports.length > 1 ? (
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2">
            <ReportDots
              total={reports.length}
              activeIndex={scenario.primaryIndex}
              labels={reports.map((r) => r.formatKey)}
            />
            <button
              type="button"
              onClick={() => onOpenFull(scenario.primaryIndex)}
              className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
            >
              Show all ({reports.length} reports) →
            </button>
          </div>
        ) : null}
        {isFailed ? (
          <p className="mt-2 text-[11px] text-[var(--color-status-failed)]">
            ※ 失敗前に書かれた部分的なレポートです。
          </p>
        ) : null}
      </div>
    </ResultFrame>
  )
}

function ResultFrame({
  title,
  accent,
  warning,
  actions,
  children,
}: {
  title: string
  accent: boolean
  warning?: boolean
  actions: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      aria-label="結果"
      className={cn(
        'rounded-md border p-3',
        warning
          ? 'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/20'
          : accent
            ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]/30 shadow-sm shadow-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]/40',
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileText
            size={12}
            className={
              warning
                ? 'text-[var(--color-status-failed)]'
                : accent
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)]'
            }
          />
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              accent
                ? 'text-[var(--color-accent)]'
                : warning
                  ? 'text-[var(--color-status-failed)]'
                  : 'text-[var(--color-muted-strong)]',
            )}
          >
            {title}
          </p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

function MarkdownPreview({ content, maxLines }: { content: string; maxLines: number }) {
  const lines = content.split('\n')
  const truncated = lines.length > maxLines
  const preview = truncated ? lines.slice(0, maxLines).join('\n') : content

  return (
    <div className="relative">
      <pre className="overflow-hidden font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
        {preview}
      </pre>
      {truncated ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--color-panel)]/95 to-transparent"
        />
      ) : null}
    </div>
  )
}

function ReportDots({
  total,
  activeIndex,
  labels,
}: {
  total: number
  activeIndex: number
  labels: string[]
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
      {Array.from({ length: total }).map((_, i) => {
        const active = i === activeIndex
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <span
              className={cn(
                'inline-block size-1.5 rounded-full',
                active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]',
              )}
            />
            <span
              className={cn(
                'font-mono text-[10px]',
                active ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]',
              )}
            >
              {labels[i]}
            </span>
          </span>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result Full View Dialog
// ---------------------------------------------------------------------------

function ResultFullView({
  scenario,
  initialIndex,
  onClose,
}: {
  scenario: MockScenario
  initialIndex: number
  onClose: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const active = scenario.reports[activeIndex]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex((i) => i - 1)
      if (e.key === 'ArrowRight' && activeIndex < scenario.reports.length - 1)
        setActiveIndex((i) => i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, scenario.reports.length])

  if (!active) return null

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      title={`Result — ${scenario.taskTitle}`}
      description={`run · ${scenario.runId ?? '—'}`}
      bodyClassName="flex flex-col min-h-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Report tabs */}
        <div
          role="tablist"
          aria-label="Reports"
          className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-5 py-2"
        >
          {scenario.reports.map((r, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={r.fileName}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]',
                  )}
                />
                <span className="font-medium">{r.formatKey}</span>
                <span className="text-[10px] text-[var(--color-muted)] group-hover:text-[var(--color-muted-strong)]">
                  step: {r.stepName}
                </span>
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div
          role="tabpanel"
          className="flex-1 overflow-auto bg-[var(--color-surface)]/30 px-6 py-5"
        >
          <article className="mx-auto max-w-3xl">
            <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
              {active.content}
            </pre>
          </article>
        </div>

        {/* Footer with file path + actions */}
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3">
          <div className="min-w-0 truncate text-[11px] text-[var(--color-muted-strong)]">
            <span className="text-[var(--color-muted)]">file:</span>{' '}
            <span className="font-mono text-[var(--color-text)]">
              .takt/runs/{scenario.runId ?? 'unknown'}/reports/{active.fileName}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" leading={<Copy size={12} />}>
              Copy
            </Button>
            <Button type="button" variant="ghost" size="sm" leading={<ExternalLink size={12} />}>
              Open in editor
            </Button>
            <Button type="button" variant="ghost" size="sm" leading={<FolderOpen size={12} />}>
              Reveal
            </Button>
          </div>
        </footer>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Done lane task card mock — shows summary first-line preview
// ---------------------------------------------------------------------------

function MockDoneCard({ scenario }: { scenario: MockScenario }) {
  const primary = scenario.reports[scenario.primaryIndex]
  const previewLine = primary ? extractFirstParagraph(primary.content) : null
  const hasReports = scenario.reports.length > 0
  const showPreview = scenario.status === 'ok' && hasReports

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2
          size={14}
          className={
            scenario.taskStatus === 'failed'
              ? 'mt-0.5 shrink-0 text-[var(--color-status-failed)]'
              : 'mt-0.5 shrink-0 text-[var(--color-status-completed)]'
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text-strong)]">
            {scenario.taskTitle}
          </p>
          {showPreview && previewLine ? (
            <p className="mt-1 line-clamp-2 text-[11.5px] text-[var(--color-muted-strong)]">
              {previewLine}
            </p>
          ) : scenario.status === 'external' ? (
            <p className="mt-1 text-[11px] italic text-[var(--color-muted)]">
              external execution — no result
            </p>
          ) : scenario.status === 'no_reports' ? (
            <p className="mt-1 text-[11px] italic text-[var(--color-muted)]">
              no structured reports
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
            {showPreview ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
                <FileText size={10} />
                {scenario.reports.length > 1
                  ? `${scenario.reports.length} reports`
                  : primary?.formatKey}
              </span>
            ) : null}
            {scenario.branch ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <GitBranch size={10} />
                {scenario.branch}
              </span>
            ) : null}
            <span className="ml-auto font-mono tabular-nums">14:32</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function extractFirstParagraph(markdown: string): string {
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    return line
      .replace(/^[-*]\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
  }
  return ''
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
      {children}
    </p>
  )
}
