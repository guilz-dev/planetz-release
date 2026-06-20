import type { IntentLedgerEntry } from '@planetz/shared'
import { useI18n } from '../i18n'
import { Button } from './ui/button'
import { cn } from './ui/cn'

interface DecisionCardProps {
  entry: IntentLedgerEntry
  busy: boolean
  onRatify: (entryId: string) => void
  onReverse: (entryId: string) => void
  onAdopt: (entryId: string) => void
  onFix: (entryId: string) => void
  onOpenTask?: (taskId: string) => void
}

function TraceValue({ value }: { value: string }) {
  return <span className="font-mono text-[var(--color-text)]">{value}</span>
}

export function DecisionCard({
  entry,
  busy,
  onRatify,
  onReverse,
  onAdopt,
  onFix,
  onOpenTask,
}: DecisionCardProps) {
  const { t } = useI18n()
  const isObserved = entry.authority === 'observed'
  const isAssumed = entry.authority === 'assumed'
  const showAdoptFix = isObserved || Boolean(entry.unanchored)
  const showRatifyReverse = isAssumed && !showAdoptFix

  return (
    <article
      className={cn(
        'rounded-lg border bg-[var(--color-panel)]/80 p-4 shadow-sm',
        entry.unanchored
          ? 'border-[var(--color-status-exceeded)]/50'
          : 'border-[var(--color-border)]',
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-[var(--color-text-strong)]">
          {entry.statement}
        </p>
        {isObserved ? (
          <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {t('views.decisions.observedBadge')}
          </span>
        ) : null}
        {entry.unanchored ? (
          <span className="shrink-0 rounded-md border border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-status-exceeded)]">
            {t('views.decisions.unanchoredBadge')}
          </span>
        ) : null}
      </div>
      <dl className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div>
            <dt className="inline">{t('views.decisions.meta.task')}: </dt>
            <dd className="inline font-mono text-[var(--color-text)]">
              {onOpenTask ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => onOpenTask(entry.taskId)}
                >
                  {entry.taskId}
                </button>
              ) : (
                entry.taskId
              )}
            </dd>
          </div>
          <div>
            <dt className="inline">{t('views.decisions.meta.run')}: </dt>
            <dd className="inline font-mono text-[var(--color-text)]">{entry.sourceRun}</dd>
          </div>
          {entry.reversibility ? (
            <div>
              <dt className="inline">{t('views.decisions.meta.reversibility')}: </dt>
              <dd className="inline text-[var(--color-text)]">{entry.reversibility}</dd>
            </div>
          ) : null}
        </div>
        {entry.scopeHint ? (
          <div>
            <dt className="inline">{t('views.decisions.meta.scope')}: </dt>
            <dd className="inline text-[var(--color-text)]">{entry.scopeHint}</dd>
          </div>
        ) : null}
        {entry.sourceDoc ? (
          <div>
            <dt className="inline">
              {isObserved ? t('views.decisions.meta.evidence') : t('views.decisions.meta.source')}:{' '}
            </dt>
            <dd className="inline">
              <TraceValue value={entry.sourceDoc} />
            </dd>
          </div>
        ) : null}
        {entry.promotedReqId ? (
          <div>
            <dt className="inline">{t('views.decisions.meta.promotedReq')}: </dt>
            <dd className="inline">
              <TraceValue value={entry.promotedReqId} />
            </dd>
          </div>
        ) : null}
        {entry.satisfies?.length ? (
          <div>
            <dt className="inline">{t('views.decisions.meta.satisfies')}: </dt>
            <dd className="inline">
              <TraceValue value={entry.satisfies.join(', ')} />
            </dd>
          </div>
        ) : null}
        {entry.deviates?.length ? (
          <div>
            <dt className="inline">{t('views.decisions.meta.deviates')}: </dt>
            <dd className="inline">
              <TraceValue value={entry.deviates.join(', ')} />
            </dd>
          </div>
        ) : null}
      </dl>
      {isAssumed ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">{t('views.decisions.assumedHint')}</p>
      ) : null}
      {isObserved ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {t('views.decisions.observedHint')}
        </p>
      ) : null}
      {entry.unanchored ? (
        <p className="mt-2 rounded-md border border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 px-2 py-1.5 text-xs text-[var(--color-status-exceeded)]">
          {t('views.decisions.unanchoredHint')}
        </p>
      ) : null}
      {entry.scopeConflict ? (
        <p className="mt-2 rounded-md border border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 px-2 py-1.5 text-xs text-[var(--color-status-exceeded)]">
          {t('views.decisions.scopeConflictHint')}
        </p>
      ) : null}
      {showRatifyReverse ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => onRatify(entry.id)}>
            {t('views.decisions.actions.ratify')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => onReverse(entry.id)}
          >
            {t('views.decisions.actions.reverse')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled
            title={t('views.decisions.actions.deferHint')}
          >
            {t('views.decisions.actions.defer')}
          </Button>
        </div>
      ) : null}
      {showAdoptFix ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => onAdopt(entry.id)}>
            {t('views.decisions.actions.adopt')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => onFix(entry.id)}
          >
            {t('views.decisions.actions.fix')}
          </Button>
        </div>
      ) : null}
    </article>
  )
}
