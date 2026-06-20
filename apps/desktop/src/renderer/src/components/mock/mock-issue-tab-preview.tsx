import { buildIssueTaskDraft } from '@planetz/shared'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Github,
  Play,
  Send,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { ISSUE_BODY_PREVIEW_LINE_COUNT, issueBodyPreviewLines } from '../issue-tab-presentational'
import { IssueTabSectionCard } from '../issue-tab-section-card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { StatusDot } from '../ui/status-dot'

/**
 * Design mock for the Issue tab + GitHub workflow run spec
 * (docs/issues/planetz-issue-tab-github-workflow-run-design-2026-05-31.md §5).
 *
 * Static, self-contained preview for design review only — no IPC, no gh.
 * Open at `#mock/issue-tab`.
 */

interface MockIssue {
  repo: string
  number: number
  title: string
  state: 'open' | 'closed'
  author: string
  url: string
  labels: string[]
  body: string
}

const MOCK_ISSUE: MockIssue = {
  repo: 'guilz-dev/planetz',
  number: 368,
  title: 'Zero-defect release gate for desktop E2E',
  state: 'open',
  author: 'kaz',
  url: 'https://github.com/guilz-dev/planetz/issues/368',
  labels: ['enhancement', 'desktop'],
  body: `## Summary

Add a zero-defect checklist before desktop releases.

## Acceptance criteria

- [ ] Playwright smoke passes on CI
- [ ] Lint / typecheck clean
- [ ] No open P0 regressions in the lane

## Notes

Origin repo resolution for \`#123\` refs should use workspace git remote.`,
}

const WORKFLOW_OPTIONS = ['feature-implement', 'bugfix', 'default', 'research-spike'] as const

function mockIssueToView(issue: MockIssue) {
  const [owner = '', name = ''] = issue.repo.split('/')
  return {
    repository: { owner, name },
    number: issue.number,
    title: issue.title,
    body: issue.body,
    url: issue.url,
    state: issue.state,
    labels: issue.labels,
    author: issue.author,
  }
}

function buildTaskDraft(issue: MockIssue): string {
  return buildIssueTaskDraft(mockIssueToView(issue))
}

function IssueTabPanel({
  issue,
  showError,
  pendingCount,
  selectedWorkflow,
  onSelectWorkflow,
}: {
  issue: MockIssue | null
  showError: boolean
  pendingCount: number
  selectedWorkflow: string | null
  onSelectWorkflow: (name: string) => void
}) {
  const [issueRef, setIssueRef] = useState('guilz-dev/planetz#368')
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [draft, setDraft] = useState(() => (issue ? buildTaskDraft(issue) : ''))

  useEffect(() => {
    if (issue) setDraft(buildTaskDraft(issue))
  }, [issue])

  const bodyPreview = issue ? issueBodyPreviewLines(issue.body, ISSUE_BODY_PREVIEW_LINE_COUNT) : ''
  const singleRunBlocked = pendingCount > 0

  return (
    <div className="flex flex-col gap-4">
      <IssueTabSectionCard title="Issue を読み込む">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted-strong)]">Issue 参照</span>
          <input
            type="text"
            value={issueRef}
            onChange={(e) => setIssueRef(e.target.value)}
            placeholder="URL / owner/repo#123 / #123"
            className="focus-ring h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-mono text-sm text-[var(--color-text)]"
          />
        </label>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted-strong)]">
          受理形式: GitHub URL、`owner/repo#123`、または `#123`（`#123` はワークスペースの{' '}
          <span className="font-mono">origin</span> から repo を解決）。
        </p>
        {showError ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/25 px-3 py-2.5 text-xs text-[var(--color-text)]"
          >
            <p className="font-medium text-[var(--color-status-failed)]">gh_auth_required</p>
            <p className="mt-1 text-[var(--color-muted-strong)]">
              GitHub CLI が未認証です。ターミナルで{' '}
              <code className="rounded bg-[var(--color-surface)] px-1 py-px font-mono text-[11px]">
                gh auth login
              </code>{' '}
              を実行してから再試行してください。
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" size="sm" leading={<Github size={13} />}>
            Issue を読み込む
          </Button>
        </div>
      </IssueTabSectionCard>

      {issue && !showError ? (
        <>
          <IssueTabSectionCard title="Issue プレビュー">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <Badge
                  tone={issue.state === 'open' ? 'completed' : 'accent'}
                  leading={<StatusDot tone={issue.state === 'open' ? 'completed' : 'neutral'} />}
                >
                  {issue.state}
                </Badge>
                <h3 className="min-w-0 flex-1 text-base font-semibold text-[var(--color-text-strong)]">
                  {issue.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted-strong)]">
                <span className="font-mono">
                  {issue.repo}#{issue.number}
                </span>
                <span>@{issue.author}</span>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                >
                  GitHub で開く
                  <ExternalLink size={11} />
                </a>
              </div>
              {issue.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-[var(--color-panel-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)] ring-1 ring-inset ring-[var(--color-border-strong)]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2.5">
                <button
                  type="button"
                  onClick={() => setBodyExpanded((v) => !v)}
                  className="mb-2 flex w-full items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]"
                >
                  {bodyExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Issue 本文
                </button>
                <pre className="overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
                  {bodyExpanded ? issue.body : bodyPreview}
                  {!bodyExpanded &&
                  issue.body.split('\n').length > ISSUE_BODY_PREVIEW_LINE_COUNT ? (
                    <span className="text-[var(--color-muted)]"> …</span>
                  ) : null}
                </pre>
              </div>
            </div>
          </IssueTabSectionCard>

          <IssueTabSectionCard title="実行設定">
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--color-muted-strong)]">
                  Workflow <span className="text-[var(--color-status-failed)]">*</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WORKFLOW_OPTIONS.map((name) => {
                    const active = selectedWorkflow === name
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onSelectWorkflow(name)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted-strong)] hover:text-[var(--color-text)]',
                        )}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--color-muted-strong)]">
                  Task draft
                </span>
                <textarea
                  rows={10}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="focus-ring w-full resize-y rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-2 font-mono text-xs leading-relaxed text-[var(--color-text)]"
                />
              </label>
            </div>
          </IssueTabSectionCard>

          <IssueTabSectionCard title="アクション">
            {singleRunBlocked ? (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--color-status-pending)]/30 bg-[var(--color-status-pending-soft)]/20 px-3 py-2 text-xs text-[var(--color-text)]">
                <AlertTriangle
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--color-status-pending)]"
                />
                <p>
                  既存の pending タスクが{' '}
                  <span className="font-semibold tabular-nums">{pendingCount}</span>{' '}
                  件あります。単体実行する前に処理するか、キュー追加のみを利用してください。
                </p>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" leading={<Send size={13} />}>
                キューに追加
              </Button>
              <Button
                variant="primary"
                size="sm"
                leading={<Play size={13} />}
                disabled={singleRunBlocked || !selectedWorkflow}
              >
                単体で実行
              </Button>
            </div>
          </IssueTabSectionCard>
        </>
      ) : null}
    </div>
  )
}

export function MockIssueTabPreview() {
  const [showError, setShowError] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>('feature-implement')

  const issue = useMemo(() => (showError ? null : MOCK_ISSUE), [showError])

  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  return (
    <div className="min-h-screen overflow-auto bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-strong)]">
            UI Mock · planetz
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
            Issue tab — GitHub Issue → workflow run
          </h1>
          <p className="mt-1 text-[12px] text-[var(--color-muted-strong)]">
            Static preview for design review. Spec:{' '}
            <span className="font-mono">
              planetz-issue-tab-github-workflow-run-design-2026-05-31.md
            </span>
            . Append <span className="font-mono">#mock/issue-tab</span> to the URL.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 px-3 py-2.5 text-xs">
          <span className="font-medium text-[var(--color-text)]">Review toggles</span>
          <label className="inline-flex items-center gap-1.5 text-[var(--color-muted-strong)]">
            <input
              type="checkbox"
              checked={showError}
              onChange={(e) => setShowError(e.target.checked)}
              className="rounded border-[var(--color-border-strong)]"
            />
            gh_auth_required
          </label>
          <label className="inline-flex items-center gap-1.5 text-[var(--color-muted-strong)]">
            <input
              type="checkbox"
              checked={pendingCount > 0}
              onChange={(e) => setPendingCount(e.target.checked ? 2 : 0)}
              className="rounded border-[var(--color-border-strong)]"
            />
            pending &gt; 0（単体実行ガード）
          </label>
        </div>

        <IssueTabPanel
          issue={issue}
          showError={showError}
          pendingCount={pendingCount}
          selectedWorkflow={selectedWorkflow}
          onSelectWorkflow={setSelectedWorkflow}
        />

        <footer className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 p-3 text-xs text-[var(--color-muted-strong)]">
          <p className="mb-1 font-medium text-[var(--color-text)]">Notes</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Rail icon: Github (not CircleDot).</li>
            <li>Errors stay inline under the input — not toast-only.</li>
            <li>Single-run uses enqueue + runPendingTask; blocked when pending &gt; 0.</li>
            <li>Production copy moves to i18n keys under views.issue.*.</li>
          </ul>
        </footer>
      </main>
    </div>
  )
}
