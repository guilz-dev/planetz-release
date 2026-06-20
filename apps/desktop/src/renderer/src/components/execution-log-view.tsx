import type {
  ExecutionAnalyticsWindow,
  ExecutionLogEventTypeFilter,
  ExecutionLogQuery,
  ExecutionLogRecord,
  ExecutionLogTaskStatusFilter,
  ExecutorState,
} from '@planetz/shared'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useExecutionLogList } from '../hooks/use-execution-log-list'
import { useI18n } from '../i18n'
import { getExecutionAnalyticsBridgeGap } from '../lib/orbit-bridge-guard'
import { resolveEmptyLogMessage } from '../lib/resolve-empty-log-message'
import { useAppStore } from '../store/app-store'
import { BridgeCapabilityBanner } from './bridge-capability-banner'
import { ExecutionLogHeader } from './execution-log-header'
import { ExecutionLogRowDetail } from './execution-log-row-detail'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Input } from './ui/input'
import { Select } from './ui/select'

interface ExecutionLogViewProps {
  executors: ExecutorState[]
  onOpenTask?: (taskId: string) => void
}

const WINDOW_OPTIONS: ExecutionAnalyticsWindow[] = ['24h', '7d', '30d', 'all']
const EVENT_TYPE_OPTIONS: ExecutionLogEventTypeFilter[] = [
  'all',
  'step_start',
  'step_complete',
  'workflow_complete',
  'workflow_abort',
  'log',
]
const TASK_STATUS_OPTIONS: ExecutionLogTaskStatusFilter[] = [
  'all',
  'pending',
  'running',
  'stopped',
  'completed',
  'failed',
  'exceeded',
]

function formatLogTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isErrorRow(row: ExecutionLogRecord): boolean {
  return row.eventType === 'workflow_abort' || row.level === 'error'
}

export function ExecutionLogView({ executors, onOpenTask }: ExecutionLogViewProps) {
  const { t } = useI18n()
  const executionLogPreset = useAppStore((s) => s.executionLogPreset)
  const clearExecutionLogPreset = useAppStore((s) => s.clearExecutionLogPreset)
  const logExecutorFilter = useAppStore((s) => s.executorFilterByView.log)
  const setExecutorFilter = useAppStore((s) => s.setExecutorFilter)

  const [keyword, setKeyword] = useState('')
  const [runIdFilter, setRunIdFilter] = useState('')
  const [timeWindow, setTimeWindow] = useState<ExecutionAnalyticsWindow>('7d')
  const [eventType, setEventType] = useState<ExecutionLogEventTypeFilter>('all')
  const [taskStatus, setTaskStatus] = useState<ExecutionLogTaskStatusFilter>('all')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const executorId = logExecutorFilter ?? 'all'

  const buildQuery = useCallback(
    (cursor?: string): ExecutionLogQuery => ({
      keyword: runIdFilter ? undefined : keyword.trim() || undefined,
      runId: runIdFilter.trim() || undefined,
      window: timeWindow,
      eventType,
      taskStatus,
      executorId,
      cursor,
    }),
    [keyword, runIdFilter, timeWindow, eventType, taskStatus, executorId],
  )

  const {
    records,
    total,
    rawTotalInWindow,
    truncated,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
  } = useExecutionLogList({
    buildQuery,
    queryDeps: [keyword, runIdFilter, timeWindow, eventType, taskStatus, executorId],
  })

  useEffect(() => {
    if (!executionLogPreset) return
    if (executionLogPreset.runId !== undefined) {
      setRunIdFilter(executionLogPreset.runId)
      setKeyword('')
    } else if (executionLogPreset.keyword !== undefined) {
      setKeyword(executionLogPreset.keyword)
      setRunIdFilter('')
    }
    if (executionLogPreset.window !== undefined) setTimeWindow(executionLogPreset.window)
    if (executionLogPreset.taskStatus !== undefined) setTaskStatus(executionLogPreset.taskStatus)
    if (executionLogPreset.executorId !== undefined) {
      const id = executionLogPreset.executorId
      setExecutorFilter('log', id === 'all' ? undefined : id)
    }
    clearExecutionLogPreset()
    setExpandedRowId(null)
  }, [executionLogPreset, clearExecutionLogPreset, setExecutorFilter])

  const emptyMessage = resolveEmptyLogMessage(rawTotalInWindow, total, t)
  const showTruncatedHint = truncated && !hasMore

  const resultSummary = loading
    ? t('views.log.loading')
    : `${t('views.log.resultCount', { shown: records.length, total })}${
        showTruncatedHint ? ` · ${t('views.log.truncatedHint')}` : ''
      }${truncated && !showTruncatedHint ? ` · ${t('views.log.truncated')}` : ''}`

  const bridgeGap = getExecutionAnalyticsBridgeGap()
  if (bridgeGap.length > 0) {
    return (
      <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
        <ExecutionLogHeader />
        <BridgeCapabilityBanner missing={bridgeGap} />
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <ExecutionLogHeader resultSummary={resultSummary} />

      <div className="grid gap-2 border-b border-[var(--color-border)]/70 px-3 pb-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-1">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('views.log.searchPlaceholder')}
            aria-label={t('views.log.searchPlaceholder')}
            className="h-8 text-xs"
            disabled={runIdFilter.length > 0}
          />
          {runIdFilter.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto self-start px-0 py-0 text-[10px] text-[var(--color-muted)]"
              onClick={() => setRunIdFilter('')}
            >
              {t('views.log.clearRunFilter')}
            </Button>
          ) : null}
        </div>
        <Select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value as ExecutionAnalyticsWindow)}
          aria-label={t('views.log.filterWindow')}
          className="h-8 text-xs"
        >
          {WINDOW_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`views.log.window.${opt}`)}
            </option>
          ))}
        </Select>
        <Select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as ExecutionLogEventTypeFilter)}
          aria-label={t('views.log.filterEventType')}
          className="h-8 text-xs"
        >
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`views.log.eventType.${opt}`)}
            </option>
          ))}
        </Select>
        <Select
          value={taskStatus}
          onChange={(e) => setTaskStatus(e.target.value as ExecutionLogTaskStatusFilter)}
          aria-label={t('views.log.filterTaskStatus')}
          className="h-8 text-xs"
        >
          {TASK_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`views.log.taskStatus.${opt}`)}
            </option>
          ))}
        </Select>
        <Select
          value={executorId}
          onChange={(e) => {
            const value = e.target.value
            setExecutorFilter('log', value === 'all' ? undefined : value)
          }}
          aria-label={t('views.log.filterExecutor')}
          className="h-8 text-xs"
        >
          <option value="all">{t('views.log.filterExecutorAll')}</option>
          {executors.map((executor) => (
            <option key={executor.id} value={executor.id}>
              {executor.displayName}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="px-3 py-4 text-xs text-[var(--color-status-failed)]" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && records.length === 0 && !error ? (
        <p className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">{emptyMessage}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-[var(--color-panel)]/95 backdrop-blur-sm">
                <tr className="border-b border-[var(--color-border)]/70 text-[var(--color-muted)]">
                  <th className="px-3 py-2 font-medium">{t('views.log.colTime')}</th>
                  <th className="px-3 py-2 font-medium">{t('views.log.colExecutor')}</th>
                  <th className="px-3 py-2 font-medium">{t('views.log.colTask')}</th>
                  <th className="px-3 py-2 font-medium">{t('views.log.colRun')}</th>
                  <th className="px-3 py-2 font-medium">{t('views.log.colEvent')}</th>
                  <th className="px-3 py-2 font-medium">{t('views.log.colMessage')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const expanded = expandedRowId === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          'cursor-pointer border-b border-[var(--color-border)]/40 hover:bg-[var(--color-panel)]/40',
                          isErrorRow(row) && 'text-[var(--color-status-failed)]',
                        )}
                        onClick={() => setExpandedRowId(expanded ? null : row.id)}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[var(--color-muted)]">
                          {formatLogTime(row.at)}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2 text-[var(--color-text-strong)]">
                          {row.executorName ?? '—'}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2">
                          {row.taskTitle ?? row.taskId ?? '—'}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-[var(--color-muted-strong)]">
                          {row.runId}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 uppercase tracking-wide text-[var(--color-muted)]">
                          {row.eventType}
                        </td>
                        <td className="max-w-[16rem] truncate px-3 py-2">{row.message ?? '—'}</td>
                      </tr>
                      {expanded ? (
                        <tr
                          key={`${row.id}:detail`}
                          className="border-b border-[var(--color-border)]/40 bg-[var(--color-surface)]/50"
                        >
                          <td colSpan={6} className="px-3 py-3">
                            <ExecutionLogRowDetail row={row} onOpenTask={onOpenTask} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <div className="shrink-0 border-t border-[var(--color-border)]/70 px-3 py-2">
              <Button
                type="button"
                variant="subtle"
                size="sm"
                disabled={loadingMore || loading}
                onClick={() => void loadMore()}
              >
                {loadingMore ? t('views.log.loading') : t('views.log.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
