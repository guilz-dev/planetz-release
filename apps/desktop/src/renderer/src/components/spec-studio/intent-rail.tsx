import type {
  IntentDraft,
  IntentLedgerAuthority,
  IntentLedgerEntry,
  SpecWorkbenchPhase,
  TaskSupplyTraceItem,
} from '@planetz/shared'
import { ChevronDown, ChevronRight, GitBranch, History, Pencil } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { useSpecThreadRail } from '../../hooks/use-spec-thread-rail'
import { useWorkspaceLedgerSummary } from '../../hooks/use-workspace-ledger-summary'
import { useWorkspaceValidationSummary } from '../../hooks/use-workspace-validation-summary'
import { useI18n } from '../../i18n/use-i18n'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { SpecKiroRailSection } from './spec-kiro-rail-section'
import type { SpecStudioChrome } from './spec-studio-chrome'

const AUTHORITY_BADGE: Record<IntentLedgerAuthority, string> = {
  required:
    'border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  designed:
    'border-[var(--color-border-strong)] bg-[var(--color-panel-strong)] text-[var(--color-text)]',
  assumed:
    'border-[var(--color-status-pending)]/40 bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]',
  observed:
    'border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)] text-[var(--color-status-exceeded)]',
  ratified:
    'border-[var(--color-status-completed)]/40 bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]',
  reversed:
    'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]',
}

export function isDriftEntry(entry: IntentLedgerEntry): boolean {
  return entry.authority === 'observed' && entry.ratifiedAt === null && Boolean(entry.unanchored)
}

function sortEntriesForWorkbench(
  entries: IntentLedgerEntry[],
  workbenchPhase: SpecWorkbenchPhase,
): IntentLedgerEntry[] {
  if (workbenchPhase !== 'trace') return entries
  return [...entries].sort((a, b) => {
    const aDrift = isDriftEntry(a) ? 0 : 1
    const bDrift = isDriftEntry(b) ? 0 : 1
    return aDrift - bDrift
  })
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone,
      )}
    >
      {children}
    </span>
  )
}

export function IntentRail({
  c,
  threadId,
  rail,
  workbenchPhase,
  highlightedEntryId,
  onOpenTask,
  onHighlightEntry,
  onOpenAllDecisions,
  onRefreshThreadSummaries,
}: {
  c: SpecStudioChrome
  threadId: string | null
  rail: ReturnType<typeof useSpecThreadRail>
  workbenchPhase: SpecWorkbenchPhase
  highlightedEntryId: string | null
  onOpenTask: (taskId: string) => void
  onHighlightEntry: (entryId: string) => void
  onOpenAllDecisions: () => void
  onRefreshThreadSummaries?: () => void | Promise<void>
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const {
    pendingCount: ledgerPendingCount,
    unanchoredCount: ledgerUnanchoredCount,
    refresh: refreshWorkspaceLedger,
  } = useWorkspaceLedgerSummary()
  const { summary: validationSummary, refresh: refreshValidationSummary } =
    useWorkspaceValidationSummary()
  const handleAfterAdjudication = useCallback(async () => {
    await refreshWorkspaceLedger()
    await refreshValidationSummary()
    await onRefreshThreadSummaries?.()
  }, [refreshWorkspaceLedger, refreshValidationSummary, onRefreshThreadSummaries])
  const [traceOpen, setTraceOpen] = useState(workbenchPhase === 'trace')
  const [kiroOpen, setKiroOpen] = useState(workbenchPhase === 'decide')
  const sortedEntries = useMemo(
    () => sortEntriesForWorkbench(rail.entries, workbenchPhase),
    [rail.entries, workbenchPhase],
  )

  useEffect(() => {
    setTraceOpen(workbenchPhase === 'trace')
    setKiroOpen(workbenchPhase === 'decide')
  }, [workbenchPhase])

  if (!threadId) {
    return (
      <aside
        aria-label="Intent rail"
        className="flex min-h-0 flex-col gap-3 bg-[var(--color-surface-elevated)]/30 p-3"
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center text-xs text-[var(--color-muted)]">
          {c.noThreadSelected}
        </div>
        <WorkspaceDecisionsPanel
          c={c}
          pendingCount={ledgerPendingCount}
          unanchoredCount={ledgerUnanchoredCount}
          onOpenAllDecisions={onOpenAllDecisions}
        />
        <WorkspaceValidationPanel
          threadId={null}
          orphanReqCount={validationSummary.orphanReqCount}
          nakedIntentThreadCount={validationSummary.nakedIntentThreadCount}
          threadOrphanReqIds={[]}
        />
      </aside>
    )
  }

  const { intent, intentDraft, versions, entries } = rail

  const adrList =
    sortedEntries.length === 0 ? (
      <p className="px-0.5 text-xs text-[var(--color-muted)]">{c.noDecisions}</p>
    ) : (
      <ul className="space-y-2">
        {sortedEntries.map((entry) => (
          <li key={entry.id}>
            <DecisionRailCard
              c={c}
              entry={entry}
              rail={rail}
              highlighted={highlightedEntryId === entry.id}
              emphasizeDrift={workbenchPhase === 'trace' && isDriftEntry(entry)}
              onAfterAdjudication={handleAfterAdjudication}
            />
          </li>
        ))}
      </ul>
    )

  return (
    <aside
      aria-label="Intent rail"
      className="flex min-h-0 flex-col gap-3 overflow-auto bg-[var(--color-surface-elevated)]/30 p-3"
    >
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {c.decidedIntent}
          </p>
          <div className="flex items-center gap-1.5">
            {intent ? (
              <span className="rounded-full bg-[var(--color-panel-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text)]">
                v{intent.version}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <History size={11} />
              {c.history}
            </button>
          </div>
        </div>

        {editing ? (
          <IntentEditor
            c={c}
            draft={intentDraft}
            generating={rail.draftGenerating}
            hasSavedIntent={intent !== null}
            onCancel={() => setEditing(false)}
            onDraftChange={(draft) => rail.saveIntentDraft(draft)}
            onGenerate={() => {
              void rail.generateIntentDraft()
            }}
            onSave={async (input) => {
              await rail.saveIntent(input)
              await refreshValidationSummary()
              setEditing(false)
            }}
          />
        ) : intent ? (
          <>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="text-[var(--color-muted)]">{c.intentWhat}</dt>
                <dd className="mt-0.5 font-medium text-[var(--color-text-strong)]">
                  {intent.what}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">{c.intentWhy}</dt>
                <dd className="mt-0.5 text-[var(--color-text)]">{intent.why}</dd>
              </div>
              {intent.outOfScope.length > 0 ? (
                <div>
                  <dt className="text-[var(--color-muted)]">{c.intentOutOfScope}</dt>
                  <dd className="mt-0.5 text-[var(--color-text)]">
                    {intent.outOfScope.join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                leading={<Pencil size={12} />}
                onClick={() => setEditing(true)}
              >
                {c.edit}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-[var(--color-muted)]">{c.noIntentYet}</p>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                leading={<Pencil size={12} />}
                onClick={() => setEditing(true)}
              >
                {c.edit}
              </Button>
            </div>
          </>
        )}

        {historyOpen && versions.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
            {versions.map((version) => (
              <li key={version.id} className="text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--color-panel-strong)] px-1.5 py-0.5 font-semibold text-[var(--color-text)]">
                    v{version.version}
                  </span>
                  <span className="text-[var(--color-muted)]">
                    {version.createdAt.slice(0, 10)}
                  </span>
                </div>
                <p className="mt-1 text-[var(--color-text)]">{version.what}</p>
                {version.reason ? (
                  <p className="mt-0.5 text-[var(--color-muted)]">
                    {c.changeReason}: {version.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {workbenchPhase === 'clarify' ? (
        <details className="rounded-lg border border-[var(--color-border)]/60 px-2 py-1">
          <summary className="cursor-pointer px-0.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {c.adrTitle}
          </summary>
          <div className="mt-2 pb-1">{adrList}</div>
        </details>
      ) : (
        <section>
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {c.adrTitle}
          </p>
          {adrList}
        </section>
      )}

      <TraceSection
        c={c}
        taskIds={rail.taskIds}
        trace={rail.trace}
        entries={entries}
        open={traceOpen}
        onOpenChange={setTraceOpen}
        onOpenTask={onOpenTask}
        onHighlightEntry={onHighlightEntry}
      />

      <SpecKiroRailSection open={kiroOpen} onOpenChange={setKiroOpen} />

      <WorkspaceDecisionsPanel
        c={c}
        pendingCount={ledgerPendingCount}
        unanchoredCount={ledgerUnanchoredCount}
        onOpenAllDecisions={onOpenAllDecisions}
      />

      <WorkspaceValidationPanel
        threadId={threadId}
        orphanReqCount={validationSummary.orphanReqCount}
        nakedIntentThreadCount={validationSummary.nakedIntentThreadCount}
        threadOrphanReqIds={
          validationSummary.threads.find((entry) => entry.threadId === threadId)?.orphanReqIds ?? []
        }
      />
    </aside>
  )
}

function WorkspaceValidationPanel({
  threadId,
  orphanReqCount,
  nakedIntentThreadCount,
  threadOrphanReqIds,
}: {
  threadId: string | null
  orphanReqCount: number
  nakedIntentThreadCount: number
  threadOrphanReqIds: string[]
}) {
  const { t } = useI18n()

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-3 text-xs">
      <p className="text-[var(--color-text)]">
        {t('specStudio.validationOrphanReqs', { count: orphanReqCount })}
      </p>
      <p className="mt-1 text-[var(--color-text)]">
        {t('specStudio.validationNakedIntents', { count: nakedIntentThreadCount })}
      </p>
      {threadId ? (
        <div className="mt-2 border-t border-[var(--color-border)]/70 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
            {t('specStudio.validationThreadOrphans')}
          </p>
          {threadOrphanReqIds.length === 0 ? (
            <p className="mt-1 text-[var(--color-muted)]">
              {t('specStudio.validationThreadOrphansEmpty')}
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--color-text)]">
              {threadOrphanReqIds.map((reqId) => (
                <li key={reqId}>{reqId}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}

function WorkspaceDecisionsPanel({
  c,
  pendingCount,
  unanchoredCount,
  onOpenAllDecisions,
}: {
  c: SpecStudioChrome
  pendingCount: number
  unanchoredCount: number
  onOpenAllDecisions: () => void
}) {
  const { t } = useI18n()

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-3 text-xs">
      <p className="text-[var(--color-text)]">
        {t('specStudio.ledgerPending', { count: pendingCount })}
      </p>
      <p className="mt-1 text-[var(--color-text)]">
        {t('specStudio.ledgerUnanchored', { count: unanchoredCount })}
      </p>
      <Button
        type="button"
        variant="subtle"
        size="sm"
        className="mt-2"
        onClick={onOpenAllDecisions}
      >
        {c.openAllDecisions}
      </Button>
    </section>
  )
}

export function TraceTaskRow({
  c,
  taskId,
  item,
  onOpenTask,
  onHighlightEntry,
}: {
  c: SpecStudioChrome
  taskId: string
  item: TaskSupplyTraceItem | undefined
  onOpenTask: (taskId: string) => void
  onHighlightEntry: (entryId: string) => void
}) {
  const snapshot = item?.snapshot ?? null
  const suppliedEntries = item?.suppliedEntries ?? []

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-mono text-[11px] text-[var(--color-text)]">{taskId}</p>
        <Button size="sm" variant="ghost" onClick={() => onOpenTask(taskId)}>
          {c.traceOpenTask}
        </Button>
      </div>
      <TraceSupplyStatus
        c={c}
        snapshot={snapshot}
        suppliedEntries={suppliedEntries}
        onHighlightEntry={onHighlightEntry}
      />
    </li>
  )
}

function TraceSupplyStatus({
  c,
  snapshot,
  suppliedEntries,
  onHighlightEntry,
}: {
  c: SpecStudioChrome
  snapshot: TaskSupplyTraceItem['snapshot']
  suppliedEntries: IntentLedgerEntry[]
  onHighlightEntry: (entryId: string) => void
}) {
  if (snapshot == null) {
    return <p className="mt-2 text-[10px] text-[var(--color-muted)]">{c.supplyApprox}</p>
  }
  if (snapshot.entryIds.length === 0) {
    return <p className="mt-2 text-[10px] text-[var(--color-muted)]">{c.traceNoSupply}</p>
  }
  if (suppliedEntries.length === 0) {
    return <p className="mt-2 text-[10px] text-[var(--color-muted)]">{c.traceSupplyStale}</p>
  }
  return (
    <ul className="mt-2 space-y-1">
      {suppliedEntries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onHighlightEntry(entry.id)}
            className="w-full rounded-md border border-[var(--color-border)]/70 px-2 py-1 text-left text-[11px] text-[var(--color-text)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent-soft)]/30"
          >
            <span className="font-medium">{entry.statement}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
              {c.traceViewInRail}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function TraceSection({
  c,
  taskIds,
  trace,
  entries,
  open,
  onOpenChange,
  onOpenTask,
  onHighlightEntry,
}: {
  c: SpecStudioChrome
  taskIds: string[]
  trace: TaskSupplyTraceItem[]
  entries: IntentLedgerEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenTask: (taskId: string) => void
  onHighlightEntry: (entryId: string) => void
}) {
  const driftCount = entries.filter(isDriftEntry).length

  const traceByTaskId = useMemo(() => new Map(trace.map((item) => [item.taskId, item])), [trace])

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <GitBranch size={13} className="text-[var(--color-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
          {c.trace}
        </span>
        {taskIds.length > 0 ? (
          <span className="ml-auto rounded-full bg-[var(--color-panel-strong)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-strong)]">
            {taskIds.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="space-y-3 px-3 pb-3 text-xs">
          {taskIds.length === 0 ? (
            <p className="text-[var(--color-muted)]">{c.traceEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {taskIds.map((taskId) => (
                <TraceTaskRow
                  key={taskId}
                  c={c}
                  taskId={taskId}
                  item={traceByTaskId.get(taskId)}
                  onOpenTask={onOpenTask}
                  onHighlightEntry={onHighlightEntry}
                />
              ))}
            </ul>
          )}
          {driftCount > 0 ? (
            <p className="rounded-md border border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 px-2 py-1 text-[var(--color-status-exceeded)]">
              {c.traceDrift}: {driftCount}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function IntentEditor({
  c,
  draft,
  generating,
  hasSavedIntent,
  onCancel,
  onDraftChange,
  onGenerate,
  onSave,
}: {
  c: SpecStudioChrome
  draft: IntentDraft | null
  generating: boolean
  hasSavedIntent: boolean
  onCancel: () => void
  onDraftChange: (draft: IntentDraft) => Promise<void>
  onGenerate: () => Promise<void> | void
  onSave: (input: {
    what: string
    why: string
    outOfScope?: string[]
    reason?: string
  }) => Promise<void>
}) {
  const [what, setWhat] = useState(draft?.what ?? '')
  const [why, setWhy] = useState(draft?.why ?? '')
  const [outOfScope, setOutOfScope] = useState(draft?.outOfScopeText ?? '')
  const [autoGenerate, setAutoGenerate] = useState(draft?.autoGenerate ?? !hasSavedIntent)
  const [touchedByUser, setTouchedByUser] = useState(draft?.touchedByUser ?? false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!draft) return
    setWhat(draft.what)
    setWhy(draft.why)
    setOutOfScope(draft.outOfScopeText)
    setAutoGenerate(draft.autoGenerate)
    setTouchedByUser(draft.touchedByUser)
  }, [draft])

  const canSave = what.trim().length > 0 && why.trim().length > 0 && !saving

  const inputClass =
    'mt-1 w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]'

  const persistDraft = useCallback(
    async (next: Partial<IntentDraft>) => {
      if (!draft) return
      const merged: IntentDraft = {
        threadId: draft.threadId,
        autoGenerate,
        what,
        why,
        outOfScopeText: outOfScope,
        touchedByUser,
        basedOnIntentVersion: draft.basedOnIntentVersion ?? null,
        ...(draft.sourceTurnId ? { sourceTurnId: draft.sourceTurnId } : {}),
        ...(draft.generatedAt ? { generatedAt: draft.generatedAt } : {}),
        ...next,
      }
      await onDraftChange(merged)
    },
    [autoGenerate, draft, onDraftChange, outOfScope, touchedByUser, what, why],
  )

  const generatedAtLabel = draft?.generatedAt ? new Date(draft.generatedAt).toLocaleString() : null

  return (
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/50 px-2 py-1.5">
        <label className="inline-flex items-center gap-1.5 text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(event) => {
              const checked = event.target.checked
              setAutoGenerate(checked)
              void (async () => {
                if (checked) {
                  setTouchedByUser(false)
                  await persistDraft({ autoGenerate: true, touchedByUser: false })
                  await onGenerate()
                  return
                }
                await persistDraft({ autoGenerate: false })
              })()
            }}
          />
          {c.intentDraftAutoGenerate}
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={generating || !autoGenerate}
          onClick={() => {
            void onGenerate()
          }}
        >
          {c.intentDraftRegenerate}
        </Button>
      </div>
      {generating ? (
        <p className="text-[11px] text-[var(--color-muted)]">{c.intentDraftGenerating}</p>
      ) : generatedAtLabel ? (
        <p className="text-[11px] text-[var(--color-muted)]">
          {c.intentDraftGeneratedAt} {generatedAtLabel}
        </p>
      ) : null}
      <label className="block text-[var(--color-muted)]">
        {c.intentWhat}
        <textarea
          rows={2}
          value={what}
          onChange={(e) => {
            const value = e.target.value
            setWhat(value)
            setAutoGenerate(false)
            setTouchedByUser(true)
            void persistDraft({
              what: value,
              autoGenerate: false,
              touchedByUser: true,
            })
          }}
          placeholder={c.placeholderWhat}
          className={inputClass}
        />
      </label>
      <label className="block text-[var(--color-muted)]">
        {c.intentWhy}
        <textarea
          rows={2}
          value={why}
          onChange={(e) => {
            const value = e.target.value
            setWhy(value)
            setAutoGenerate(false)
            setTouchedByUser(true)
            void persistDraft({
              why: value,
              autoGenerate: false,
              touchedByUser: true,
            })
          }}
          placeholder={c.placeholderWhy}
          className={inputClass}
        />
      </label>
      <label className="block text-[var(--color-muted)]">
        {c.intentOutOfScope}
        <input
          value={outOfScope}
          onChange={(e) => {
            const value = e.target.value
            setOutOfScope(value)
            setAutoGenerate(false)
            setTouchedByUser(true)
            void persistDraft({
              outOfScopeText: value,
              autoGenerate: false,
              touchedByUser: true,
            })
          }}
          placeholder={c.placeholderOutOfScope}
          className={inputClass}
        />
      </label>
      <label className="block text-[var(--color-muted)]">
        {c.changeReason}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={c.placeholderReason}
          className={inputClass}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!canSave}
          onClick={async () => {
            setSaving(true)
            try {
              const scope = outOfScope
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              await onSave({
                what: what.trim(),
                why: why.trim(),
                ...(scope.length > 0 ? { outOfScope: scope } : {}),
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              })
            } finally {
              setSaving(false)
            }
          }}
        >
          {c.save}
        </Button>
      </div>
    </div>
  )
}

function DecisionRailCard({
  c,
  entry,
  rail,
  highlighted = false,
  emphasizeDrift = false,
  onAfterAdjudication,
}: {
  c: SpecStudioChrome
  entry: IntentLedgerEntry
  rail: ReturnType<typeof useSpecThreadRail>
  highlighted?: boolean
  emphasizeDrift?: boolean
  onAfterAdjudication?: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const isPending =
    (entry.authority === 'assumed' || entry.authority === 'observed') && entry.ratifiedAt === null
  const showAdoptFix = entry.authority === 'observed' || Boolean(entry.unanchored)

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true)
    try {
      await action()
      await onAfterAdjudication?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      id={`spec-studio-entry-${entry.id}`}
      className={cn(
        'rounded-lg border bg-[var(--color-panel)]/80 p-3 shadow-sm transition-colors',
        highlighted
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
          : emphasizeDrift || entry.unanchored
            ? 'border-[var(--color-status-exceeded)]/50'
            : 'border-[var(--color-border)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={AUTHORITY_BADGE[entry.authority]}>{c.authorityLabel[entry.authority]}</Badge>
        {entry.reversibility ? (
          <span className="text-[10px] text-[var(--color-muted)]">
            {entry.reversibility === 'cheap' ? c.reversibilityCheap : c.reversibilityExpensive}
          </span>
        ) : null}
        {entry.unanchored ? (
          <Badge tone={AUTHORITY_BADGE.observed}>{c.unanchoredBadge}</Badge>
        ) : null}
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          {entry.createdAt.slice(0, 10)}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">{entry.statement}</p>

      <div className="mt-1.5 space-y-0.5 text-[11px] text-[var(--color-muted)]">
        {entry.satisfies?.length ? (
          <p>
            {c.satisfies}:{' '}
            <span className="text-[var(--color-text)]">{entry.satisfies.join(', ')}</span>
          </p>
        ) : null}
        {entry.deviates?.length ? (
          <p>
            {c.deviates}:{' '}
            <span className="text-[var(--color-text)]">{entry.deviates.join(', ')}</span>
          </p>
        ) : null}
        {entry.sourceDoc ? (
          <p>
            {c.source}: <span className="text-[var(--color-text)]">{entry.sourceDoc}</span>
          </p>
        ) : null}
      </div>

      {entry.promotedReqId ? (
        <span className="mt-2 inline-flex items-center rounded-md border border-[var(--color-status-completed)]/40 bg-[var(--color-status-completed-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-status-completed)]">
          {c.promoted}: {entry.promotedReqId}
        </span>
      ) : null}

      {isPending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {showAdoptFix ? (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={run(() => rail.adopt(entry.id))}
              >
                {c.actionsAdopt}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={run(() => rail.fix(entry.id))}
              >
                {c.actionsFix}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={run(() => rail.ratify(entry.id))}
              >
                {c.actionsRatify}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={run(() => rail.reverse(entry.id))}
              >
                {c.actionsReverse}
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{c.settled}</p>
      )}
    </article>
  )
}
