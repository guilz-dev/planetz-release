import type { IntentLedgerEntry } from '@planetz/shared'
import { useCallback, useState } from 'react'
import type { ConfirmDialogRequest } from '../hooks/use-confirm-dialog'
import { useIntentLedgerQueue } from '../hooks/use-intent-ledger-queue'
import { usePushToast } from '../hooks/use-toast'
import { useI18n } from '../i18n'
import { DecisionCard } from './decision-card'
import { KiroSpecsPanel } from './kiro-specs-panel'
import { Button } from './ui/button'
import { cn } from './ui/cn'

interface DecisionsViewProps {
  onOpenTask?: (taskId: string) => void
  requestConfirm: (req: ConfirmDialogRequest | string) => Promise<boolean>
  onEnqueueTask: (draft: { title: string; body: string }) => Promise<unknown>
}

export function DecisionsView({ onOpenTask, requestConfirm, onEnqueueTask }: DecisionsViewProps) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null)
  const {
    entries,
    loading,
    error,
    reload,
    expensiveOnly,
    setExpensiveOnly,
    filterTaskId,
    clearFilter,
  } = useIntentLedgerQueue()

  const enqueueFixTask = useCallback(
    async (entry: IntentLedgerEntry) => {
      const confirmed = await requestConfirm({
        title: t('views.decisions.fixTask.confirmTitle'),
        message: t('views.decisions.fixTask.confirmMessage', { statement: entry.statement }),
        confirmLabel: t('views.decisions.fixTask.confirm'),
      })
      if (!confirmed) return
      await onEnqueueTask({
        title: t('views.decisions.fixTask.title'),
        body: t('views.decisions.fixTask.body', {
          statement: entry.statement,
          taskId: entry.taskId,
          sourceRun: entry.sourceRun,
        }),
      })
    },
    [onEnqueueTask, requestConfirm, t],
  )

  const runMutation = useCallback(
    async (
      entryId: string,
      action: 'ratify' | 'reverse' | 'adopt' | 'fix',
      entry?: IntentLedgerEntry,
    ) => {
      setBusyEntryId(entryId)
      try {
        if (action === 'ratify') {
          await window.orbit.ratifyIntentLedgerEntry({ entryId })
          pushToast({ kind: 'success', message: t('views.decisions.toast.ratified') })
        } else if (action === 'reverse') {
          await window.orbit.reverseIntentLedgerEntry({ entryId })
          pushToast({ kind: 'success', message: t('views.decisions.toast.reversed') })
          if (entry) {
            await enqueueFixTask(entry)
          }
        } else if (action === 'adopt') {
          const confirmed = await requestConfirm({
            title: t('views.decisions.adoptTask.confirmTitle'),
            message: t('views.decisions.adoptTask.confirmMessage', {
              statement: entry?.statement ?? entryId,
            }),
            confirmLabel: t('views.decisions.adoptTask.confirm'),
          })
          if (!confirmed) return
          const result = await window.orbit.adoptIntentLedgerEntry({ entryId })
          if (result.promotedReqIdUnlinked && result.promotedReqId) {
            pushToast({
              kind: 'warn',
              message: t('views.decisions.toast.adoptedReqUnlinked', {
                reqId: result.promotedReqId,
              }),
            })
          } else if (result.promotedReqId) {
            pushToast({
              kind: 'success',
              message: t('views.decisions.toast.adoptedWithReq', { reqId: result.promotedReqId }),
            })
          } else {
            pushToast({ kind: 'success', message: t('views.decisions.toast.adopted') })
          }
        } else {
          const confirmed = await requestConfirm({
            title: t('views.decisions.fixAdjudicate.confirmTitle'),
            message: t('views.decisions.fixAdjudicate.confirmMessage', {
              statement: entry?.statement ?? entryId,
            }),
            confirmLabel: t('views.decisions.fixAdjudicate.confirm'),
          })
          if (!confirmed) return
          await window.orbit.fixIntentLedgerEntry({ entryId })
          pushToast({ kind: 'success', message: t('views.decisions.toast.fixed') })
          if (entry) {
            await enqueueFixTask(entry)
          }
        }
        await reload()
      } catch (cause) {
        pushToast({
          kind: 'error',
          message: cause instanceof Error ? cause.message : t('views.decisions.toast.failed'),
        })
      } finally {
        setBusyEntryId(null)
      }
    },
    [enqueueFixTask, pushToast, reload, requestConfirm, t],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <KiroSpecsPanel />
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-sm font-semibold text-[var(--color-text-strong)]">
          {t('views.decisions.title')}
        </h1>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t('views.decisions.description')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={expensiveOnly}
              onChange={(event) => setExpensiveOnly(event.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            {t('views.decisions.expensiveOnly')}
          </label>
          {filterTaskId ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
              <span>{t('views.decisions.filterTask', { taskId: filterTaskId })}</span>
              <Button type="button" size="sm" variant="ghost" onClick={clearFilter}>
                {t('views.decisions.clearTaskFilter')}
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">{t('views.decisions.loading')}</p>
        ) : null}
        {error ? (
          <div className="space-y-2">
            <p className={cn('text-sm text-[var(--color-alert)]')}>{error}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void reload()}>
              {t('views.decisions.retry')}
            </Button>
          </div>
        ) : null}
        {!loading && !error && entries.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t('views.decisions.empty')}</p>
        ) : null}
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <DecisionCard
                entry={entry}
                busy={busyEntryId === entry.id}
                onRatify={(entryId) => void runMutation(entryId, 'ratify')}
                onReverse={(entryId) => void runMutation(entryId, 'reverse', entry)}
                onAdopt={(entryId) => void runMutation(entryId, 'adopt', entry)}
                onFix={(entryId) => void runMutation(entryId, 'fix', entry)}
                onOpenTask={onOpenTask}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
