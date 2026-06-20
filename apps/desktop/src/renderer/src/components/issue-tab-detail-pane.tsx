import { formatIssueRefKey, type GitHubIssueView } from '@planetz/shared'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Pencil,
  Play,
  Send,
  Sparkles,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useI18n } from '../i18n'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Popover, PopoverAnchor } from './ui/popover'
import { StatusDot } from './ui/status-dot'

export interface IssueTabDetailPaneProps {
  issue: GitHubIssueView
  totalCount: number
  runningCount: number
  bodyContent: ReactNode
  draft: string
  onDraftChange: (value: string) => void
  draftRows?: number
  actionBusy: boolean
  issueLoading?: boolean
  pendingCount: number
  workflowControl: ReactNode
  workflowReady: boolean
  canRunSingle: boolean
  onEnqueue: () => void
  onRunSingle: () => void
  onRefineInComposer: () => void
  refineBusy?: boolean
  refineError?: string | null
}

type IssueRunMode = 'now' | 'queue'

export function IssueTabDetailPane({
  issue,
  totalCount,
  runningCount,
  bodyContent,
  draft,
  onDraftChange,
  draftRows = 10,
  actionBusy,
  issueLoading = false,
  pendingCount,
  workflowControl,
  workflowReady,
  canRunSingle,
  onEnqueue,
  onRunSingle,
  onRefineInComposer,
  refineBusy = false,
  refineError = null,
}: IssueTabDetailPaneProps) {
  const { t } = useI18n()
  const [runMode, setRunMode] = useState<IssueRunMode>('now')
  const [runMenuOpen, setRunMenuOpen] = useState(false)
  const [draftExpanded, setDraftExpanded] = useState(false)
  const singleRunBlocked = pendingCount > 0
  const issueRef = formatIssueRefKey(issue.repository, issue.number)

  const runOptions = [
    { id: 'now' as const, label: t('views.issue.actions.runSingle'), icon: Play },
    { id: 'queue' as const, label: t('views.issue.actions.enqueue'), icon: Send },
  ]
  const isRunNowMode = runMode === 'now'
  const primaryDisabled = isRunNowMode
    ? !canRunSingle
    : !workflowReady || actionBusy || issueLoading
  const runMenuDisabled = actionBusy || issueLoading

  return (
    <>
      <header className="border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <Badge
            tone={issue.state === 'open' ? 'completed' : 'accent'}
            leading={<StatusDot tone={issue.state === 'open' ? 'completed' : 'neutral'} />}
          >
            {issue.state}
          </Badge>
          {runningCount > 0 ? (
            <Badge
              tone="accent"
              leading={<Loader2 size={11} className="animate-spin motion-reduce:animate-none" />}
            >
              {t('views.issue.preview.runningBadge', { count: String(runningCount) })}
            </Badge>
          ) : null}
          {totalCount > 0 ? (
            <Badge tone="neutral">
              {t('views.issue.preview.taskHistoryBadge', { count: String(totalCount) })}
            </Badge>
          ) : null}
          <h3 className="min-w-0 flex-1 text-base font-semibold text-[var(--color-text-strong)]">
            {issue.title}
          </h3>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted-strong)]">
          <span className="font-mono">{issueRef}</span>
          {issue.author ? <span>@{issue.author}</span> : null}
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            {t('views.issue.preview.openOnGitHub')}
            <ExternalLink size={11} />
          </a>
        </div>
        {issue.labels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 py-4">
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {t('views.issue.preview.bodyToggle')}
          </h4>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3">
            {bodyContent}
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
                {t('views.issue.run.draftLabel')}
              </h4>
              {draftExpanded ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted-strong)]">
                  {t('views.issue.run.draftHelp')}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              leading={draftExpanded ? <Check size={13} /> : <Pencil size={13} />}
              disabled={actionBusy}
              onClick={() => setDraftExpanded((open) => !open)}
            >
              {draftExpanded ? t('views.issue.run.draftCollapse') : t('views.issue.run.draftEdit')}
            </Button>
          </div>
          {draftExpanded ? (
            <textarea
              rows={draftRows}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={actionBusy}
              className="focus-ring w-full resize-y rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-2 font-mono text-xs leading-relaxed text-[var(--color-text)] disabled:opacity-60"
            />
          ) : (
            <button
              type="button"
              onClick={() => !actionBusy && setDraftExpanded(true)}
              disabled={actionBusy}
              className="focus-ring w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-2.5 py-2 text-left font-mono text-xs leading-relaxed text-[var(--color-text)] disabled:opacity-60"
            >
              {draft.trim() ? (
                <span className="line-clamp-2 whitespace-pre-wrap break-words text-[var(--color-muted-strong)]">
                  {draft}
                </span>
              ) : (
                <span className="text-[var(--color-muted-strong)]">
                  {t('views.issue.run.draftEmpty')}
                </span>
              )}
            </button>
          )}
        </section>
      </div>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-panel)]/70 px-5 py-3">
        {singleRunBlocked && isRunNowMode ? (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-[var(--color-status-pending)]/30 bg-[var(--color-status-pending-soft)]/20 px-3 py-2 text-xs text-[var(--color-text)]">
            <AlertTriangle
              size={14}
              className="mt-0.5 shrink-0 text-[var(--color-status-pending)]"
            />
            <p>{t('views.issue.actions.pendingBlocked', { count: String(pendingCount) })}</p>
          </div>
        ) : null}
        {refineError ? (
          <div
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/25 px-3 py-2 text-xs text-[var(--color-text)]"
          >
            <AlertTriangle
              size={14}
              className="mt-0.5 shrink-0 text-[var(--color-status-failed)]"
            />
            <p>{refineError}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-[11px] font-medium text-[var(--color-muted-strong)]">
              {t('views.issue.run.workflowLabel')}{' '}
              <span className="text-[var(--color-status-failed)]">*</span>
            </p>
            {workflowControl}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leading={
                refineBusy ? (
                  <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Sparkles size={13} />
                )
              }
              title={t('views.issue.actions.refineInComposerHint')}
              disabled={refineBusy || actionBusy || issueLoading}
              onClick={() => void onRefineInComposer()}
            >
              {t('views.issue.actions.refineInComposer')}
            </Button>
            {/* Split button (mirrors the Chat composer): primary runs the selected
                mode; the caret dropdown switches between Run single / Add to queue. */}
            <PopoverAnchor>
              <div className="inline-flex items-stretch">
                <Button
                  variant="primary"
                  size="sm"
                  leading={isRunNowMode ? <Play size={13} /> : <Send size={13} />}
                  disabled={primaryDisabled}
                  onClick={() => (isRunNowMode ? void onRunSingle() : void onEnqueue())}
                  className="min-w-[6.5rem] rounded-r-none"
                >
                  {isRunNowMode
                    ? t('views.issue.actions.runSingle')
                    : t('views.issue.actions.enqueue')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  aria-label={t('views.issue.actions.runOptionsAria')}
                  aria-haspopup="menu"
                  aria-expanded={runMenuOpen}
                  disabled={runMenuDisabled}
                  onClick={() => setRunMenuOpen((open) => !open)}
                  className="rounded-l-none border-l border-black/15 px-1.5"
                >
                  <ChevronDown size={13} />
                </Button>
              </div>
              <Popover
                open={runMenuOpen}
                onClose={() => setRunMenuOpen(false)}
                placement="top-end"
                className="min-w-[11rem] gap-0.5 p-1"
              >
                {runOptions.map((option) => {
                  const active = runMode === option.id
                  const Icon = option.icon
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setRunMode(option.id)
                        setRunMenuOpen(false)
                      }}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'text-[var(--color-text-strong)]'
                          : 'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={13} />
                        {option.label}
                      </span>
                      {active ? <Check size={13} className="text-[var(--color-accent)]" /> : null}
                    </button>
                  )
                })}
              </Popover>
            </PopoverAnchor>
          </div>
        </div>
      </footer>
    </>
  )
}
