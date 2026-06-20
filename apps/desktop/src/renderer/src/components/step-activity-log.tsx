import type { StepActivityEntry } from '@planetz/shared'
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTickingNow } from '../hooks/use-ticking-now'
import { useI18n } from '../i18n'
import { formatActivityTime } from '../lib/format-activity-time'
import { formatElapsed } from '../lib/format-elapsed'
import { ActivityIcon, LiveActivityLog } from './live-activity-log'
import { cn } from './ui/cn'

export type { StepActivityEntry, StepActivityKind } from '@planetz/shared'

interface StepActivityLogProps {
  state: 'past' | 'active' | 'future'
  latest?: StepActivityEntry
  history?: StepActivityEntry[]
  summary?: string
  completedAt?: string
  durationSec?: number
  /** When true, keep the active-step live log expanded (running task detail). */
  autoExpandLive?: boolean
}

export function StepActivityLog({
  state,
  latest,
  history,
  summary,
  completedAt,
  durationSec,
  autoExpandLive = false,
}: StepActivityLogProps) {
  const { t } = useI18n()
  const entries = history ?? []
  const [open, setOpen] = useState(() => state === 'active' && autoExpandLive)
  const userCollapsedRef = useRef(false)
  const hasHistory = entries.length > 0

  useEffect(() => {
    if (state !== 'active') {
      userCollapsedRef.current = false
    }
  }, [state])

  useEffect(() => {
    if (state === 'active' && autoExpandLive && !userCollapsedRef.current) {
      setOpen(true)
    }
  }, [state, autoExpandLive])
  const canExpand = hasHistory || Boolean((summary || completedAt) && state !== 'future')
  const localizedSummary = resolvePastStepSummary(t, summary, completedAt, durationSec)

  if (state === 'future') {
    return null
  }

  if (state === 'active' && !latest && !hasHistory) {
    return (
      <p className="mt-1 pl-7 text-[11px] italic text-[var(--color-muted)]">
        {t('panels.running.activityWaiting')}
      </p>
    )
  }

  if (state === 'active') {
    const liveEntries = entries.length > 0 ? entries : latest ? [latest] : []
    return (
      <div className="mt-1 pl-7">
        <ActiveStepHeader
          latest={latest}
          historyCount={liveEntries.length}
          open={open}
          onToggle={() => {
            setOpen((v) => {
              const next = !v
              if (!next && state === 'active' && autoExpandLive) {
                userCollapsedRef.current = true
              }
              return next
            })
          }}
        />
        {open ? <LiveActivityLog entries={liveEntries} className="mt-1" /> : null}
      </div>
    )
  }

  return (
    <div className="mt-1 pl-7">
      <button
        type="button"
        onClick={() => canExpand && setOpen((v) => !v)}
        disabled={!canExpand}
        className={cn(
          'group flex w-full items-start gap-1.5 rounded-sm py-0.5 text-left text-[11px]',
          canExpand ? 'cursor-pointer hover:bg-[var(--color-surface)]/60' : 'cursor-default',
        )}
        aria-expanded={canExpand ? open : undefined}
      >
        {canExpand ? (
          open ? (
            <ChevronDown
              size={11}
              className="mt-[3px] shrink-0 text-[var(--color-muted)]"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              size={11}
              className="mt-[3px] shrink-0 text-[var(--color-muted)]"
              aria-hidden="true"
            />
          )
        ) : (
          <span className="w-[11px] shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[var(--color-muted-strong)]">
            <span>{localizedSummary}</span>
            {hasHistory ? (
              <span className="text-[var(--color-muted)]">
                {t('panels.running.activityEntryCount', { count: entries.length })}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {open && hasHistory ? <PastStepHistoryList entries={entries} /> : null}
    </div>
  )
}

function resolvePastStepSummary(
  t: ReturnType<typeof useI18n>['t'],
  fallbackSummary: string | undefined,
  completedAt: string | undefined,
  durationSec: number | undefined,
): string {
  if (completedAt) {
    if (durationSec != null && durationSec >= 0) {
      return t('panels.running.activityCompletedIn', {
        duration: formatDurationLabel(durationSec),
      })
    }
    return t('panels.running.activityCompleted')
  }
  return fallbackSummary ?? t('panels.running.activityCompleted')
}

function formatDurationLabel(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`
}

function ActiveStepHeader({
  latest,
  historyCount,
  open,
  onToggle,
}: {
  latest?: StepActivityEntry
  historyCount: number
  open: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  const now = useTickingNow(1_000, true)
  const lastEventAt = latest ? Date.parse(latest.at) : null
  const sinceLastMs =
    lastEventAt != null && Number.isFinite(lastEventAt) ? Math.max(0, now - lastEventAt) : null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? t('panels.running.activityHideLog') : t('panels.running.activityShowLog')}
      className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[11px] hover:bg-[var(--color-surface)]/70"
    >
      {open ? (
        <ChevronDown size={11} className="shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
      ) : (
        <ChevronRight size={11} className="shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
      )}
      <Terminal size={10} className="shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
      {latest ? (
        <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-text)]">
          {latest.text}
        </span>
      ) : (
        <span className="min-w-0 flex-1 italic text-[var(--color-muted)]">
          {t('panels.running.activityWaiting')}
        </span>
      )}
      {historyCount > 0 ? (
        <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
          {t('panels.running.activityEntryCount', { count: historyCount })}
        </span>
      ) : null}
      {sinceLastMs != null ? (
        <span
          className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--color-muted)]"
          title={latest?.at}
        >
          {t('panels.running.activityLastEventAgo', { ago: formatElapsed(sinceLastMs) })}
        </span>
      ) : null}
    </button>
  )
}

function PastStepHistoryList({ entries }: { entries: StepActivityEntry[] }) {
  return (
    <ol className="mt-1 space-y-0.5 border-l border-[var(--color-border)]/60 pl-3">
      {entries.map((entry, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: activity entries may share timestamps
          key={`${entry.at}-${i}`}
          className="flex items-start gap-1.5 py-0.5 text-[11px] leading-snug"
        >
          <ActivityIcon kind={entry.kind} />
          <span
            className={cn(
              'min-w-0 flex-1 whitespace-pre-wrap break-words font-mono',
              entry.level === 'error' && 'text-[var(--color-status-failed)]',
              entry.level === 'warn' && 'text-[var(--color-status-exceeded)]',
              !entry.level && 'text-[var(--color-text)]',
            )}
          >
            {entry.text}
          </span>
          <span
            className="shrink-0 self-center font-mono text-[10px] tabular-nums text-[var(--color-muted)]"
            title={entry.at}
          >
            {formatActivityTime(entry.at)}
          </span>
        </li>
      ))}
    </ol>
  )
}
