import type { GitHubIssueErrorCode, GitHubIssueListItem } from '@planetz/shared'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Plus,
  RefreshCcw,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { type IssueTaskActivity, issueTaskActivityForRef } from '../lib/issue-task-activity'
import { issueErrorMessage, issueErrorRecoveryCommand } from './issue-tab-presentational'
import { Button } from './ui/button'

function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export interface IssueTabListPaneProps {
  listExpanded: boolean
  onToggleListExpanded: () => void
  listLoading: boolean
  actionBusy: boolean
  listErrorCode: GitHubIssueErrorCode | null
  listErrorDetail: string | null
  issueList: GitHubIssueListItem[]
  selectedIssueNumber: number | null
  activityIndex: Map<string, IssueTaskActivity>
  pageIndex: number
  canGoPrev: boolean
  canGoNext: boolean
  onRefresh: () => void
  onSelectIssue: (item: GitHubIssueListItem) => void
  onEnqueueAuto: (item: GitHubIssueListItem) => void
  onPrevPage: () => void
  onNextPage: () => void
}

export function IssueTabListPane({
  listExpanded,
  onToggleListExpanded,
  listLoading,
  actionBusy,
  listErrorCode,
  listErrorDetail,
  issueList,
  selectedIssueNumber,
  activityIndex,
  pageIndex,
  canGoPrev,
  canGoNext,
  onRefresh,
  onSelectIssue,
  onEnqueueAuto,
  onPrevPage,
  onNextPage,
}: IssueTabListPaneProps) {
  const { t } = useI18n()
  const listErrorRecoveryCommand = issueErrorRecoveryCommand(listErrorCode)

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]/40 ${
        listExpanded ? 'w-full' : 'w-[360px]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">
            {t('views.issue.list.title')}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted-strong)]">
            {t('views.issue.list.description')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leading={<RefreshCcw size={13} />}
            disabled={listLoading || actionBusy}
            onClick={() => void onRefresh()}
            aria-label={t('views.issue.list.reload')}
          >
            {listLoading ? t('views.issue.list.loading') : t('views.issue.list.reload')}
          </Button>
          <button
            type="button"
            onClick={onToggleListExpanded}
            title={t(listExpanded ? 'views.issue.list.shrink' : 'views.issue.list.expand')}
            aria-label={t(listExpanded ? 'views.issue.list.shrink' : 'views.issue.list.expand')}
            className="rounded p-1.5 text-[var(--color-muted-strong)] transition-colors hover:bg-[var(--color-panel-strong)]/50 hover:text-[var(--color-text)]"
          >
            {listExpanded ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
          </button>
        </div>
      </div>

      {listErrorCode ? (
        <div
          role="alert"
          className="m-3 rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/25 px-3 py-2.5 text-xs text-[var(--color-text)]"
        >
          <p className="font-medium text-[var(--color-status-failed)]">
            {issueErrorMessage(t, listErrorCode)}
          </p>
          {listErrorDetail ? (
            <p className="mt-1 text-[var(--color-muted-strong)]">{listErrorDetail}</p>
          ) : null}
          {listErrorRecoveryCommand ? (
            <p className="mt-1 text-[var(--color-muted-strong)]">
              {t('views.issue.list.recoveryHint', { command: listErrorRecoveryCommand })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 overflow-auto">
        {issueList.length === 0 && !listLoading ? (
          <p className="px-4 py-6 text-xs text-[var(--color-muted-strong)]">
            {t('views.issue.list.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {issueList.map((item) => {
              const selected = selectedIssueNumber === item.number
              const activity = issueTaskActivityForRef(activityIndex, item.repository, item.number)
              const isRunning = activity.runningCount > 0
              // Hide the enqueue quick-action while the issue already has an active
              // task (running or sitting in the pending queue) to prevent accidental
              // double-enqueue. A second task can still be added from the detail pane.
              const isActive = activity.runningCount > 0 || activity.queuedCount > 0
              const hasHistory = activity.totalCount > 0
              return (
                <li
                  key={`${item.repository.owner}/${item.repository.name}#${item.number}`}
                  className="group/row relative"
                >
                  {/* Stretched-link: the row's click target is a background button
                      so the quick-action can sit inline (right of the created-at)
                      rather than nested inside another button. */}
                  <button
                    type="button"
                    disabled={listLoading || actionBusy}
                    onClick={() => onSelectIssue(item)}
                    title={item.title}
                    aria-label={item.title}
                    className={`focus-ring absolute inset-0 z-0 cursor-pointer transition-colors disabled:cursor-default ${
                      selected
                        ? 'bg-[var(--color-panel-strong)]/70'
                        : 'hover:bg-[var(--color-panel-strong)]/35'
                    }`}
                  />
                  <div className="pointer-events-none relative z-10 px-4 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 pt-0.5 font-mono text-[11px] text-[var(--color-muted-strong)]">
                        #{item.number}
                      </span>
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--color-text)] break-words transition-colors group-hover/row:text-[var(--color-text-strong)]">
                        {item.title}
                      </span>
                      {listExpanded && item.labels.length > 0 ? (
                        <span className="hidden shrink-0 flex-wrap gap-1 md:flex">
                          {item.labels.slice(0, 4).map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-[var(--color-panel-strong)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-text-strong)] ring-1 ring-inset ring-[var(--color-border-strong)]"
                            >
                              {label}
                            </span>
                          ))}
                          {item.labels.length > 4 ? (
                            <span className="text-[12px] font-semibold text-[var(--color-text-strong)]">
                              +{item.labels.length - 4}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {listExpanded && item.author ? (
                        <span className="hidden shrink-0 text-[11px] text-[var(--color-muted-strong)] sm:inline">
                          @{item.author}
                        </span>
                      ) : null}
                      {isRunning ? (
                        <Loader2
                          size={14}
                          aria-label={t('views.issue.list.runningIndicator', {
                            number: String(item.number),
                          })}
                          className="mt-0.5 shrink-0 animate-spin text-[var(--color-accent)] motion-reduce:animate-none"
                        />
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-[calc(0.5rem+1.5ch)]">
                      <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                        {t('views.issue.list.createdAt', {
                          date: formatCreatedAt(item.createdAt),
                        })}
                      </span>
                      {hasHistory ? (
                        <span className="rounded-full bg-[var(--color-panel-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)] ring-1 ring-inset ring-[var(--color-border-strong)]">
                          {t('views.issue.list.taskHistoryBadge', {
                            count: String(activity.totalCount),
                          })}
                        </span>
                      ) : null}
                      {/* Hover-reveal quick action, sitting directly to the right of
                          the created-at. Subtle surface styling (not a primary fill);
                          the "Auto" badge signals the workflow is auto-selected. Hidden
                          while the issue already has an active/queued task. */}
                      {isActive ? null : (
                        <button
                          type="button"
                          disabled={listLoading || actionBusy}
                          onClick={() => onEnqueueAuto(item)}
                          title={t('views.issue.list.enqueueAutoAria', {
                            number: String(item.number),
                          })}
                          aria-label={t('views.issue.list.enqueueAutoAria', {
                            number: String(item.number),
                          })}
                          className="focus-ring pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-[var(--color-muted-strong)] opacity-0 shadow-sm transition hover:border-[var(--color-accent)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)] focus-visible:opacity-100 disabled:cursor-default group-hover/row:opacity-100"
                        >
                          <Plus size={11} aria-hidden />
                          <span>{t('views.issue.list.enqueueAuto')}</span>
                          <span className="rounded bg-[var(--color-accent-soft)] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                            {t('composer.autoToggle')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-2">
        <span className="text-[11px] text-[var(--color-muted-strong)]">
          {t('views.issue.list.page', { page: String(pageIndex + 1) })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            leading={<ChevronLeft size={13} />}
            disabled={!canGoPrev || listLoading || actionBusy}
            onClick={() => void onPrevPage()}
            aria-label={t('views.issue.list.prev')}
          >
            {t('views.issue.list.prev')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leading={<ChevronRight size={13} />}
            disabled={!canGoNext || listLoading || actionBusy}
            onClick={() => void onNextPage()}
            aria-label={t('views.issue.list.next')}
          >
            {t('views.issue.list.next')}
          </Button>
        </div>
      </div>
    </aside>
  )
}
