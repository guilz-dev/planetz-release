import type {
  ExecutionAnalyticsWindow,
  ExecutionSummary,
  IntentLedgerSummary,
  TaskStatus,
} from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import { useStaleRequestGuard } from '../hooks/use-stale-request-guard'
import { useI18n } from '../i18n'
import { getExecutionAnalyticsBridgeGap } from '../lib/orbit-bridge-guard'
import { useAppStore } from '../store/app-store'
import { BridgeCapabilityBanner } from './bridge-capability-banner'
import { Select } from './ui/select'

const WINDOW_OPTIONS: ExecutionAnalyticsWindow[] = ['24h', '7d', '30d', 'all']

const TERMINAL_STATUSES = new Set<TaskStatus>(['completed', 'failed', 'exceeded'])

const EMPTY_SUMMARY = (window: ExecutionAnalyticsWindow): ExecutionSummary => ({
  window,
  total: 0,
  completed: 0,
  failureCount: 0,
  successRate: 0,
  byStatus: [
    { status: 'completed', count: 0 },
    { status: 'failed', count: 0 },
    { status: 'exceeded', count: 0 },
  ],
  byExecutor: [],
  byWorkflow: [],
})

const EMPTY_INTENT_LEDGER_SUMMARY = (window: ExecutionAnalyticsWindow): IntentLedgerSummary => ({
  window,
  ingestedAssumedCount: 0,
  pendingCount: 0,
  ratifiedCount: 0,
  reversedCount: 0,
  adjudicationRate: null,
  scopeConflictCount: 0,
  unanchoredCount: 0,
  unanchoredRate: null,
  adjudicationLatencyP50Ms: null,
  ratifyRatio: null,
  reverseRatio: null,
  adoptCount: 0,
  fixCount: 0,
})

function formatRatePercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}

function formatLatencyMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round((ms / 3_600_000) * 10) / 10}h`
}

export function ExecutionSummaryView() {
  const { t } = useI18n()
  const stateRevision = useAppStore((s) => s.stateRevision)
  const taskCount = useAppStore((s) => s.state?.tasks.length ?? 0)
  const terminalTaskCount = useAppStore((s) => {
    const tasks = s.state?.tasks
    if (!tasks) return 0
    let count = 0
    for (const task of tasks) {
      if (TERMINAL_STATUSES.has(task.status)) count += 1
    }
    return count
  })
  const mockQueueEnabled = useAppStore((s) => s.state?.mockQueueEnabled ?? false)
  const decisionsExpensiveOnly = useAppStore((s) => s.decisionsExpensiveOnly)
  const [timeWindow, setTimeWindow] = useState<ExecutionAnalyticsWindow>('7d')
  const [summary, setSummary] = useState<ExecutionSummary>(() => EMPTY_SUMMARY('7d'))
  const [decisionsSummary, setDecisionsSummary] = useState<IntentLedgerSummary>(() =>
    EMPTY_INTENT_LEDGER_SUMMARY('7d'),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captureRequestGeneration = useStaleRequestGuard([
    timeWindow,
    stateRevision,
    decisionsExpensiveOnly,
  ])

  const load = useCallback(async () => {
    if (getExecutionAnalyticsBridgeGap().length > 0) return
    const isCurrent = captureRequestGeneration()
    setLoading(true)
    setError(null)
    setSummary(EMPTY_SUMMARY(timeWindow))
    setDecisionsSummary(EMPTY_INTENT_LEDGER_SUMMARY(timeWindow))
    try {
      const [result, ledger] = await Promise.all([
        window.orbit.getExecutionSummary({ window: timeWindow }),
        window.orbit.getIntentLedgerSummary({
          window: timeWindow,
          expensiveOnly: decisionsExpensiveOnly || undefined,
        }),
      ])
      if (!isCurrent()) return
      setSummary(result)
      setDecisionsSummary(ledger)
    } catch (err) {
      if (!isCurrent()) return
      setError(err instanceof Error ? err.message : String(err))
      setSummary(EMPTY_SUMMARY(timeWindow))
      setDecisionsSummary(EMPTY_INTENT_LEDGER_SUMMARY(timeWindow))
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [timeWindow, decisionsExpensiveOnly, captureRequestGeneration])

  // stateRevision intentionally retriggers analytics when main-process state changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when task/run projection updates
  useEffect(() => {
    void load()
  }, [load, stateRevision])

  const bridgeGap = getExecutionAnalyticsBridgeGap()
  if (bridgeGap.length > 0) {
    return (
      <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
        <header>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
            {t('views.summary.title')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {t('views.summary.description')}
          </p>
        </header>
        <BridgeCapabilityBanner missing={bridgeGap} />
      </section>
    )
  }

  const showInProgressHint =
    !loading && !error && summary.total === 0 && taskCount > 0 && terminalTaskCount === 0
  const showOutsideWindowHint = !loading && !error && summary.total === 0 && terminalTaskCount > 0

  const kpis = [
    { label: t('views.summary.kpiTotal'), value: String(summary.total) },
    { label: t('views.summary.kpiCompleted'), value: String(summary.completed) },
    { label: t('views.summary.kpiFailures'), value: String(summary.failureCount) },
    {
      label: t('views.summary.kpiSuccessRate'),
      value: `${summary.successRate}%`,
      hint: t('views.summary.taskSuccessRateHint'),
    },
  ]

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
            {t('views.summary.title')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {t('views.summary.description')}
          </p>
        </div>
        <Select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value as ExecutionAnalyticsWindow)}
          aria-label={t('views.summary.filterWindow')}
          className="h-8 min-w-[7rem] text-xs"
        >
          {WINDOW_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`views.log.window.${opt}`)}
            </option>
          ))}
        </Select>
      </header>

      {error ? (
        <p className="text-xs text-[var(--color-status-failed)]" role="alert">
          {error}
        </p>
      ) : null}

      {mockQueueEnabled ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/80 px-3 py-2 text-xs text-[var(--color-muted)]">
          {t('views.summary.mockModeHint')}
        </p>
      ) : null}

      {showInProgressHint ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/80 px-3 py-2 text-xs text-[var(--color-muted)]">
          {t('views.summary.inProgressOnlyHint', { count: String(taskCount) })}
        </p>
      ) : null}

      {showOutsideWindowHint ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/80 px-3 py-2 text-xs text-[var(--color-muted)]">
          {t('views.summary.outsideWindowHint', { count: String(terminalTaskCount) })}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-[var(--color-muted)]">{t('views.summary.loading')}</p>
      ) : null}

      <KpiGrid items={kpis} />

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
          {t('views.summary.decisionsSection')}
        </h3>
        <KpiGrid
          items={[
            {
              label: t('views.summary.decisionsIngestedAssumed'),
              value: String(decisionsSummary.ingestedAssumedCount),
            },
            {
              label: t('views.summary.decisionsPending'),
              value: String(decisionsSummary.pendingCount),
              hint: decisionsExpensiveOnly
                ? t('views.summary.decisionsPendingExpensiveHint')
                : undefined,
            },
            {
              label: t('views.summary.decisionsAdjudicationRate'),
              value:
                decisionsSummary.adjudicationRate === null
                  ? '—'
                  : formatRatePercent(decisionsSummary.adjudicationRate),
              hint: t('views.summary.decisionsAdjudicationRateHint'),
            },
            {
              label: t('views.summary.decisionsScopeConflicts'),
              value: String(decisionsSummary.scopeConflictCount),
              hint: t('views.summary.decisionsScopeConflictsHint'),
            },
            {
              label: t('views.summary.decisionsUnanchored'),
              value: String(decisionsSummary.unanchoredCount),
              hint: t('views.summary.decisionsUnanchoredHint'),
            },
            {
              label: t('views.summary.decisionsUnanchoredRate'),
              value:
                decisionsSummary.unanchoredRate === null
                  ? '—'
                  : formatRatePercent(decisionsSummary.unanchoredRate),
              hint: t('views.summary.decisionsUnanchoredRateHint'),
            },
            {
              label: t('views.summary.decisionsRatifyRatio'),
              value:
                decisionsSummary.ratifyRatio === null
                  ? '—'
                  : formatRatePercent(decisionsSummary.ratifyRatio),
              hint: t('views.summary.decisionsRatifyRatioHint'),
            },
            {
              label: t('views.summary.decisionsReverseRatio'),
              value:
                decisionsSummary.reverseRatio === null
                  ? '—'
                  : formatRatePercent(decisionsSummary.reverseRatio),
              hint: t('views.summary.decisionsReverseRatioHint'),
            },
            {
              label: t('views.summary.decisionsAdjudicationLatencyP50'),
              value:
                decisionsSummary.adjudicationLatencyP50Ms === null
                  ? '—'
                  : formatLatencyMs(decisionsSummary.adjudicationLatencyP50Ms),
              hint: t('views.summary.decisionsAdjudicationLatencyP50Hint'),
            },
            {
              label: t('views.summary.decisionsAdoptCount'),
              value: String(decisionsSummary.adoptCount),
              hint: t('views.summary.decisionsAdoptCountHint'),
            },
            {
              label: t('views.summary.decisionsFixCount'),
              value: String(decisionsSummary.fixCount),
              hint: t('views.summary.decisionsFixCountHint'),
            },
          ]}
        />
      </section>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <BreakdownCard
          title={t('views.summary.byStatus')}
          rows={summary.byStatus.map((row) => ({
            key: row.status,
            label: t(`views.log.taskStatus.${row.status}`),
            count: row.count,
          }))}
        />
        <BreakdownCard
          title={t('views.summary.byExecutor')}
          rows={summary.byExecutor.map((row) => ({
            key: row.executorId,
            label: row.executorName,
            count: row.count,
          }))}
          emptyLabel={t('views.summary.noBreakdown')}
        />
        <BreakdownCard
          title={t('views.summary.byWorkflow')}
          rows={summary.byWorkflow.map((row) => ({
            key: row.workflow,
            label: row.workflow,
            count: row.count,
          }))}
          emptyLabel={t('views.summary.noBreakdown')}
        />
      </div>
    </section>
  )
}

function KpiCard(props: { label: string; value: string; hint?: string }) {
  const { label, value, hint } = props
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/60 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text-strong)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-[var(--color-muted)]">{hint}</p> : null}
    </article>
  )
}

function KpiGrid(props: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {props.items.map((kpi) => (
        <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
      ))}
    </div>
  )
}

function BreakdownCard(props: {
  title: string
  rows: Array<{ key: string; label: string; count: number }>
  emptyLabel?: string
}) {
  const { title, rows, emptyLabel } = props
  return (
    <article className="flex min-h-[12rem] flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/60">
      <h3 className="border-b border-[var(--color-border)]/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[var(--color-muted)]">{emptyLabel ?? '—'}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-[var(--color-border)]/40 overflow-auto">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]"
            >
              <span className="min-w-0 truncate text-[var(--color-text)]">{row.label}</span>
              <span className="shrink-0 tabular-nums text-[var(--color-muted-strong)]">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
