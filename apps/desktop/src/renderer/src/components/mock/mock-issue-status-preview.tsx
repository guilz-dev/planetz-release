import { formatIssueRefKey, type GitHubIssueListItem, type GitHubIssueView } from '@planetz/shared'
import { useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../hooks/use-confirm-dialog'
import { I18nProvider } from '../../i18n/i18n-provider'
import type { IssueTaskActivity } from '../../lib/issue-task-activity'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { IssueTabDetailPane } from '../issue-tab-detail-pane'
import { IssueTabListPane } from '../issue-tab-list-pane'
import { cn } from '../ui/cn'

/**
 * Design mock for Issue list execution-status + duplicate-run confirm
 * (docs/issues/planetz-issue-list-execution-status-design-2026-05-31.md).
 *
 * Uses the same list/detail panes as production; open at `#mock/issue-status`.
 */

interface MockIssueRow {
  owner: string
  name: string
  number: number
  title: string
  state: 'open' | 'closed'
  author: string
  url: string
  labels: string[]
  body: string
  totalCount: number
  runningCount: number
  queuedCount?: number
}

const MOCK_ISSUES: MockIssueRow[] = [
  {
    owner: 'guilz-dev',
    name: 'planetz',
    number: 368,
    title: 'Zero-defect release gate for desktop E2E',
    state: 'open',
    author: 'kaz',
    url: 'https://github.com/guilz-dev/planetz/issues/368',
    labels: ['enhancement', 'desktop'],
    body: 'Add a zero-defect checklist before desktop releases.\n\n- [ ] Playwright smoke passes on CI\n- [ ] Lint / typecheck clean\n- [ ] No open P0 regressions in the lane',
    totalCount: 3,
    runningCount: 1,
  },
  {
    owner: 'guilz-dev',
    name: 'planetz',
    number: 367,
    title: 'Rich diff UI for result panel',
    state: 'open',
    author: 'kaz',
    url: 'https://github.com/guilz-dev/planetz/issues/367',
    labels: ['ui'],
    body: 'Render unified + split diffs in the result tab with syntax highlighting.',
    totalCount: 1,
    runningCount: 0,
  },
  {
    owner: 'guilz-dev',
    name: 'planetz',
    number: 361,
    title: 'Workflow form phase 1 — schema-driven inputs',
    state: 'open',
    author: 'mira',
    url: 'https://github.com/guilz-dev/planetz/issues/361',
    labels: ['workflow', 'enhancement'],
    body: 'Drive the run form from the workflow input schema.',
    totalCount: 4,
    runningCount: 2,
  },
  {
    owner: 'guilz-dev',
    name: 'planetz',
    number: 359,
    title: 'Issue tab pagination keyboard nav',
    state: 'open',
    author: 'kaz',
    url: 'https://github.com/guilz-dev/planetz/issues/359',
    labels: ['a11y'],
    body: 'Arrow keys move selection; Enter loads the issue.',
    totalCount: 0,
    runningCount: 0,
  },
]

const WORKFLOW_OPTIONS = ['feature-implement', 'bugfix', 'default', 'research-spike'] as const

function getFirstMockIssue(): MockIssueRow {
  const first = MOCK_ISSUES[0]
  if (!first) {
    throw new Error('mock issue preview requires at least one issue')
  }
  return first
}

function mockToListItem(row: MockIssueRow): GitHubIssueListItem {
  return {
    repository: { owner: row.owner, name: row.name },
    number: row.number,
    title: row.title,
    url: row.url,
    createdAt: '2026-05-31T00:00:00Z',
    state: row.state,
    labels: row.labels,
    author: row.author,
  }
}

function mockToView(row: MockIssueRow): GitHubIssueView {
  return {
    repository: { owner: row.owner, name: row.name },
    number: row.number,
    title: row.title,
    body: row.body,
    url: row.url,
    state: row.state,
    labels: row.labels,
    author: row.author,
  }
}

function mockActivityIndex(issues: MockIssueRow[]): Map<string, IssueTaskActivity> {
  const index = new Map<string, IssueTaskActivity>()
  for (const issue of issues) {
    if (issue.runningCount <= 0 && issue.totalCount <= 0) continue
    index.set(`issue:${issue.number}`, {
      totalCount: issue.totalCount,
      runningCount: issue.runningCount,
      queuedCount: issue.queuedCount ?? Math.max(0, issue.totalCount - issue.runningCount),
    })
  }
  return index
}

function MockIssueStatusPreviewBody() {
  const firstIssue = getFirstMockIssue()
  const [issues, setIssues] = useState<MockIssueRow[]>(MOCK_ISSUES)
  const [selectedNumber, setSelectedNumber] = useState<number>(firstIssue.number)
  const [pendingCount, setPendingCount] = useState(0)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('feature-implement')
  const [draft, setDraft] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const { requestConfirm, confirmDialog } = useConfirmDialog()

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.number === selectedNumber) ?? issues[0] ?? firstIssue,
    [firstIssue, issues, selectedNumber],
  )
  const issueList = useMemo(() => issues.map(mockToListItem), [issues])
  const activityIndex = useMemo(() => mockActivityIndex(issues), [issues])
  const issueView = useMemo(() => mockToView(selectedIssue), [selectedIssue])

  useEffect(() => {
    const ref = formatIssueRefKey(
      { owner: selectedIssue.owner, name: selectedIssue.name },
      selectedIssue.number,
    )
    setDraft(`[${ref}] ${selectedIssue.title}\n\n${selectedIssue.body}`)
  }, [selectedIssue])

  const runWithConfirm = async (kind: 'enqueue' | 'runSingle') => {
    setActionBusy(true)
    try {
      const ref = formatIssueRefKey(
        { owner: selectedIssue.owner, name: selectedIssue.name },
        selectedIssue.number,
      )
      if (selectedIssue.runningCount > 0) {
        const ok = await requestConfirm({
          title: '追加で実行しますか？',
          message: `Issue ${ref} は現在実行中です。追加でタスクを投入してもよろしいですか？`,
          confirmLabel: '追加する',
        })
        if (!ok) {
          setLastAction(`${kind}: キャンセル（タスク操作なし）`)
          return
        }
      }
      setLastAction(
        kind === 'enqueue'
          ? `enqueueTask 実行: ${ref}`
          : `enqueueTask → runPendingTask 実行: ${ref}`,
      )
    } finally {
      setActionBusy(false)
    }
  }

  const singleRunBlocked = pendingCount > 0
  const workflowReady = selectedWorkflow.trim().length > 0
  const canRunSingle = !singleRunBlocked && workflowReady && !actionBusy

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-3">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--color-muted-strong)] uppercase">
          UI Mock · planetz
        </p>
        <h1 className="mt-0.5 text-base font-semibold text-[var(--color-text-strong)]">
          Issue 一覧 — 実行状態表示 + 重複実行確認
        </h1>
        <p className="mt-0.5 text-[12px] text-[var(--color-muted-strong)]">
          Shared panes with production · Spec:{' '}
          <span className="font-mono">
            planetz-issue-list-execution-status-design-2026-05-31.md
          </span>
          {' · '}URL に <span className="font-mono">#mock/issue-status</span> を付与。
        </p>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel-strong)]/30 px-6 py-2 text-xs">
        <span className="font-medium text-[var(--color-text)]">Review toggles</span>
        <label className="inline-flex items-center gap-1.5 text-[var(--color-muted-strong)]">
          <input
            type="checkbox"
            checked={selectedIssue.runningCount > 0}
            onChange={(e) =>
              setIssues((prev) =>
                prev.map((issue) =>
                  issue.number === selectedNumber
                    ? { ...issue, runningCount: e.target.checked ? 1 : 0 }
                    : issue,
                ),
              )
            }
            className="rounded border-[var(--color-border-strong)]"
          />
          選択中 Issue が running（スピナー + confirm 対象）
        </label>
        <label className="inline-flex items-center gap-1.5 text-[var(--color-muted-strong)]">
          <input
            type="checkbox"
            checked={pendingCount > 0}
            onChange={(e) => setPendingCount(e.target.checked ? 2 : 0)}
            className="rounded border-[var(--color-border-strong)]"
          />
          workspace pending &gt; 0（global ガード維持）
        </label>
        {lastAction ? (
          <span className="ml-auto rounded-full bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-muted-strong)] ring-1 ring-inset ring-[var(--color-border-strong)]">
            {lastAction}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <IssueTabListPane
          listExpanded={false}
          onToggleListExpanded={() => {}}
          listLoading={false}
          actionBusy={actionBusy}
          listErrorCode={null}
          listErrorDetail={null}
          issueList={issueList}
          selectedIssueNumber={selectedNumber}
          activityIndex={activityIndex}
          pageIndex={0}
          canGoPrev={false}
          canGoNext={false}
          onRefresh={() => {}}
          onSelectIssue={(item: GitHubIssueListItem) => {
            setSelectedNumber(item.number)
            setLastAction(null)
          }}
          onEnqueueAuto={(item: GitHubIssueListItem) => {
            setSelectedNumber(item.number)
            setLastAction(`enqueue:auto #${item.number}`)
          }}
          onPrevPage={() => {}}
          onNextPage={() => {}}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          <IssueTabDetailPane
            issue={issueView}
            totalCount={selectedIssue.totalCount}
            runningCount={selectedIssue.runningCount}
            draftRows={6}
            bodyContent={
              <pre className="overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
                {selectedIssue.body}
              </pre>
            }
            draft={draft}
            onDraftChange={setDraft}
            actionBusy={actionBusy}
            pendingCount={pendingCount}
            workflowReady={workflowReady}
            canRunSingle={canRunSingle}
            onEnqueue={() => void runWithConfirm('enqueue')}
            onRunSingle={() => void runWithConfirm('runSingle')}
            onRefineInComposer={() => {}}
            workflowControl={
              <div className="flex flex-wrap gap-1.5">
                {WORKFLOW_OPTIONS.map((name) => {
                  const active = selectedWorkflow === name
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedWorkflow(name)}
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
            }
          />
        </section>
      </div>
      {confirmDialog}
    </div>
  )
}

export function MockIssueStatusPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  return (
    <I18nProvider>
      <MockIssueStatusPreviewBody />
    </I18nProvider>
  )
}
