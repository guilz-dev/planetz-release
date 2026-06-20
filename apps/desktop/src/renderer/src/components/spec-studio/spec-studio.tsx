import type {
  IntentLedgerEntry,
  RecentWorkspace,
  SpecThreadPhase,
  SpecThreadSummary,
  SpecWorkbenchPhase,
  TaskSupplyTraceItem,
  TaskViewModel,
} from '@planetz/shared'
import { Plus, Search } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useSpecThreadArtifacts } from '../../hooks/use-spec-thread-artifacts'
import { useSpecThreadRail } from '../../hooks/use-spec-thread-rail'
import { useSpecThreads } from '../../hooks/use-spec-threads'
import { useSpecWorkbenchPhase } from '../../hooks/use-spec-workbench-phase'
import type { PromptComposerRunDraft } from '../../lib/prompt-composer-run-draft'
import { useAppStore } from '../../store/app-store'
import type { ChatMode } from '../../types/chat-mode'
import type { ChatEmptyCopyVariant } from '../chat/chat-empty-state'
import { ChatView } from '../chat/chat-view'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { IntentRail, isDriftEntry, TraceTaskRow } from './intent-rail'
import { NextStepBanner } from './next-step-banner'
import { SpecArtifactsPanel } from './spec-artifacts-panel'
import { SpecPhaseStepper } from './spec-phase-stepper'
import { type SpecStudioChrome, useSpecStudioChrome } from './spec-studio-chrome'

const STATUS_DOT: Record<SpecThreadPhase, string> = {
  clarify: 'bg-[var(--color-muted)]',
  decided: 'bg-[var(--color-accent)]',
  implementing: 'bg-[var(--color-status-running)]',
  drift: 'bg-[var(--color-status-exceeded)]',
}

function workbenchControlledMode(phase: SpecWorkbenchPhase): ChatMode {
  if (phase === 'decide') return 'spec'
  return 'interactive'
}

type SpecStudioChatWorkbenchProps = {
  selectedThreadId: string | null
  onActiveThreadChange: (threadId: string | null) => void
  onThreadStreamSettled?: (input: {
    threadId: string | null
    latestAssistantTurnId: string | null
  }) => void
  newChatSignal: number
  workbenchPhase: SpecWorkbenchPhase
  emptyCopyVariant: ChatEmptyCopyVariant
  currentWorkspacePath?: string
  allowedProviders?: ReadonlyArray<string>
  recentWorkspaces?: ReadonlyArray<RecentWorkspace>
  onChangeWorkspace?: () => void
  onOpenRecentWorkspace?: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace?: (path: string) => Promise<void>
  onEnqueueSpec?: (draft: PromptComposerRunDraft) => Promise<void>
  onRunNowSpec?: (draft: PromptComposerRunDraft) => Promise<void>
}

function SpecStudioChatWorkbench({
  selectedThreadId,
  onActiveThreadChange,
  onThreadStreamSettled,
  newChatSignal,
  workbenchPhase,
  emptyCopyVariant,
  currentWorkspacePath,
  allowedProviders,
  recentWorkspaces = [],
  onChangeWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onEnqueueSpec,
  onRunNowSpec,
}: SpecStudioChatWorkbenchProps) {
  return (
    <ChatView
      hideSidebar
      externalSelectedThreadId={selectedThreadId}
      onActiveThreadChange={onActiveThreadChange}
      onThreadStreamSettled={onThreadStreamSettled}
      newChatSignal={newChatSignal}
      controlledMode={workbenchControlledMode(workbenchPhase)}
      hideModeSwitcher
      emptyCopyVariant={emptyCopyVariant}
      currentWorkspacePath={currentWorkspacePath}
      allowedProviders={allowedProviders}
      recentWorkspaces={recentWorkspaces}
      onChangeWorkspace={onChangeWorkspace}
      onOpenRecentWorkspace={onOpenRecentWorkspace}
      onRemoveRecentWorkspace={onRemoveRecentWorkspace}
      onEnqueueSpec={onEnqueueSpec}
      onRunNowSpec={onRunNowSpec}
    />
  )
}

export interface SpecStudioProps {
  tasks?: TaskViewModel[]
  currentWorkspacePath?: string
  allowedProviders?: ReadonlyArray<string>
  recentWorkspaces?: ReadonlyArray<RecentWorkspace>
  onChangeWorkspace?: () => void
  onOpenRecentWorkspace?: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace?: (path: string) => Promise<void>
  onEnqueueSpec?: (draft: PromptComposerRunDraft) => Promise<void>
  onRunNowSpec?: (draft: PromptComposerRunDraft) => Promise<void>
}

export function SpecStudio({
  tasks = [],
  currentWorkspacePath,
  allowedProviders,
  recentWorkspaces = [],
  onChangeWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onEnqueueSpec,
  onRunNowSpec,
}: SpecStudioProps) {
  const c = useSpecStudioChrome()
  const setActiveView = useAppStore((s) => s.setActiveView)

  const { summaries, refresh: refreshThreads } = useSpecThreads()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [newChatSignal, setNewChatSignal] = useState(0)
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null)
  const generatedTurnByThreadRef = useRef<Record<string, string>>({})

  const rail = useSpecThreadRail(activeThreadId)
  const artifactsState = useSpecThreadArtifacts(rail.taskIds, tasks)

  const activeSummary = useMemo(
    () => summaries.find((thread) => thread.threadId === activeThreadId) ?? null,
    [summaries, activeThreadId],
  )

  const { workbenchPhase, setWorkbenchPhaseManual, resetForNewSpec } =
    useSpecWorkbenchPhase(activeSummary)

  const threads = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return summaries
    return summaries.filter((thread) => thread.title.toLowerCase().includes(q))
  }, [query, summaries])

  const handleSelect = useCallback((threadId: string) => {
    setSelectedThreadId(threadId)
    setActiveThreadId(threadId)
  }, [])

  // Keep the list highlight in sync with the controller's active thread, so a
  // thread created from "New spec" highlights once its first turn lands.
  const handleActiveThreadChange = useCallback((threadId: string | null) => {
    setActiveThreadId(threadId)
    if (threadId) setSelectedThreadId(threadId)
  }, [])

  const handleNewSpec = useCallback(() => {
    setSelectedThreadId(null)
    setActiveThreadId(null)
    resetForNewSpec()
    setNewChatSignal((value) => value + 1)
  }, [resetForNewSpec])

  // Attach the active spec thread as the originating thread for enqueued specs.
  const withSourceThread = useCallback(
    (draft: PromptComposerRunDraft): PromptComposerRunDraft =>
      activeThreadId ? { ...draft, sourceThreadId: activeThreadId } : draft,
    [activeThreadId],
  )

  const handleEnqueueSpec = useMemo(
    () =>
      onEnqueueSpec
        ? async (draft: PromptComposerRunDraft) => {
            await onEnqueueSpec(withSourceThread(draft))
            await refreshThreads()
          }
        : undefined,
    [onEnqueueSpec, withSourceThread, refreshThreads],
  )

  const handleRunNowSpec = useMemo(
    () =>
      onRunNowSpec
        ? async (draft: PromptComposerRunDraft) => {
            await onRunNowSpec(withSourceThread(draft))
            await refreshThreads()
          }
        : undefined,
    [onRunNowSpec, withSourceThread, refreshThreads],
  )

  const handleOpenTask = useCallback(
    (taskId: string) => {
      setActiveView('task')
      void window.orbit?.selectTask(taskId)
    },
    [setActiveView],
  )

  const handleHighlightEntry = useCallback((entryId: string) => {
    setHighlightedEntryId(entryId)
    requestAnimationFrame(() => {
      document
        .getElementById(`spec-studio-entry-${entryId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  const handleHighlightDrift = useCallback(() => {
    const driftEntry = rail.entries.find(isDriftEntry)
    if (driftEntry) handleHighlightEntry(driftEntry.id)
  }, [rail.entries, handleHighlightEntry])

  const emptyCopyVariant = workbenchPhase === 'clarify' ? 'clarify-first' : 'default'

  const handleThreadStreamSettled = useCallback(
    (input: { threadId: string | null; latestAssistantTurnId: string | null }) => {
      if (!input.threadId || input.threadId !== activeThreadId) return
      if (!input.latestAssistantTurnId) return
      const threadId = input.threadId
      const sourceTurnId = input.latestAssistantTurnId
      const draft = rail.intentDraft
      if (!draft?.autoGenerate || draft.touchedByUser) return
      const lastGeneratedTurnId = generatedTurnByThreadRef.current[threadId]
      if (lastGeneratedTurnId === sourceTurnId) return
      generatedTurnByThreadRef.current[threadId] = sourceTurnId
      void rail.generateIntentDraft({ sourceTurnId }).then((nextDraft) => {
        if (!nextDraft || nextDraft.sourceTurnId !== sourceTurnId) {
          delete generatedTurnByThreadRef.current[threadId]
        }
      })
    },
    [activeThreadId, rail],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <h1 className="text-sm font-semibold text-[var(--color-text-strong)]">{c.title}</h1>
        <SpecPhaseStepper
          workbenchPhase={workbenchPhase}
          threadPhase={activeSummary?.phase ?? null}
          taskCount={activeSummary?.taskCount ?? 0}
          driftCount={activeSummary?.driftCount ?? 0}
          labels={{
            clarify: c.phaseClarify,
            decide: c.phaseDecide,
            trace: c.phaseTrace,
            stepNumbers: c.phaseStepNumbers,
            traceDisabledHint: c.phaseTraceDisabledHint,
          }}
          onSelectPhase={setWorkbenchPhaseManual}
        />
      </header>

      <NextStepBanner
        summary={activeSummary}
        workbenchPhase={workbenchPhase}
        labels={{
          clarifyTitle: c.nextStep.clarifyTitle,
          decideTitle: c.nextStep.decideTitle,
          decideAction: c.nextStep.decideAction,
          traceTitle: c.nextStep.traceTitle,
          traceAction: c.nextStep.traceAction,
          driftTitle: activeSummary ? c.nextStep.driftTitle(activeSummary.driftCount) : '',
          driftBody: c.nextStep.driftBody,
          driftAction: c.nextStep.driftAction,
        }}
        onSelectPhase={setWorkbenchPhaseManual}
        onHighlightDrift={handleHighlightDrift}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_340px] overflow-hidden">
        <ThreadList
          c={c}
          threads={threads}
          query={query}
          onQuery={setQuery}
          selectedId={selectedThreadId}
          onSelect={handleSelect}
          onNewSpec={handleNewSpec}
        />

        <section className="flex min-h-0 flex-col overflow-hidden border-x border-[var(--color-border)]">
          {workbenchPhase === 'trace' ? (
            <TraceWorkbenchCenter
              c={c}
              threadId={activeThreadId}
              taskIds={rail.taskIds}
              trace={rail.trace}
              entries={rail.entries}
              onOpenTask={handleOpenTask}
              onHighlightEntry={handleHighlightEntry}
              onBackToDecide={() => setWorkbenchPhaseManual('decide')}
            />
          ) : workbenchPhase === 'decide' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
                <SpecStudioChatWorkbench
                  selectedThreadId={selectedThreadId}
                  onActiveThreadChange={handleActiveThreadChange}
                  onThreadStreamSettled={handleThreadStreamSettled}
                  newChatSignal={newChatSignal}
                  workbenchPhase={workbenchPhase}
                  emptyCopyVariant={emptyCopyVariant}
                  currentWorkspacePath={currentWorkspacePath}
                  allowedProviders={allowedProviders}
                  recentWorkspaces={recentWorkspaces}
                  onChangeWorkspace={onChangeWorkspace}
                  onOpenRecentWorkspace={onOpenRecentWorkspace}
                  onRemoveRecentWorkspace={onRemoveRecentWorkspace}
                  onEnqueueSpec={handleEnqueueSpec}
                  onRunNowSpec={handleRunNowSpec}
                />
              </div>
              <SpecArtifactsPanel
                artifacts={artifactsState.artifacts}
                artifactsLoading={artifactsState.artifactsLoading}
                artifactsError={artifactsState.artifactsError}
                artifactTaskId={artifactsState.artifactTaskId}
              />
            </div>
          ) : (
            <SpecStudioChatWorkbench
              selectedThreadId={selectedThreadId}
              onActiveThreadChange={handleActiveThreadChange}
              onThreadStreamSettled={handleThreadStreamSettled}
              newChatSignal={newChatSignal}
              workbenchPhase={workbenchPhase}
              emptyCopyVariant={emptyCopyVariant}
              currentWorkspacePath={currentWorkspacePath}
              allowedProviders={allowedProviders}
              recentWorkspaces={recentWorkspaces}
              onChangeWorkspace={onChangeWorkspace}
              onOpenRecentWorkspace={onOpenRecentWorkspace}
              onRemoveRecentWorkspace={onRemoveRecentWorkspace}
              onEnqueueSpec={handleEnqueueSpec}
              onRunNowSpec={handleRunNowSpec}
            />
          )}
        </section>

        <IntentRail
          c={c}
          threadId={activeThreadId}
          rail={rail}
          workbenchPhase={workbenchPhase}
          highlightedEntryId={highlightedEntryId}
          onOpenTask={handleOpenTask}
          onHighlightEntry={handleHighlightEntry}
          onOpenAllDecisions={() => setActiveView('decisions')}
          onRefreshThreadSummaries={refreshThreads}
        />
      </div>
    </div>
  )
}

function ThreadList({
  c,
  threads,
  query,
  onQuery,
  selectedId,
  onSelect,
  onNewSpec,
}: {
  c: SpecStudioChrome
  threads: SpecThreadSummary[]
  query: string
  onQuery: (value: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onNewSpec: () => void
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-[var(--color-surface-elevated)]/30">
      <div className="space-y-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
          {c.threads}
        </p>
        <Button
          variant="subtle"
          size="sm"
          className="w-full"
          leading={<Plus size={13} />}
          onClick={onNewSpec}
        >
          {c.newSpec}
        </Button>
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2">
          <Search size={12} className="text-[var(--color-muted)]" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={c.search}
            className="h-7 w-full bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
        {threads.map((summary) => {
          const isActive = summary.threadId === selectedId
          return (
            <li key={summary.threadId}>
              <button
                type="button"
                onClick={() => onSelect(summary.threadId)}
                className={cn(
                  'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                  isActive
                    ? 'border-[var(--color-accent)]/50 bg-[var(--color-panel-strong)]'
                    : 'border-transparent hover:bg-[var(--color-panel)]',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[summary.phase])}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-strong)]">
                    {summary.title}
                  </span>
                </div>
                <p className="mt-0.5 pl-4 text-[11px] text-[var(--color-muted)]">
                  {c.statusLabel[summary.phase]}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
                  {summary.adrCount > 0 ? (
                    <span className="rounded-full bg-[var(--color-panel-strong)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-strong)]">
                      ADR {summary.adrCount}
                    </span>
                  ) : null}
                  {summary.pendingCount > 0 ? (
                    <span className="rounded-full bg-[var(--color-status-pending-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-status-pending)]">
                      {c.pending} {summary.pendingCount}
                    </span>
                  ) : null}
                  {summary.driftCount > 0 ? (
                    <span className="rounded-full bg-[var(--color-status-exceeded-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-status-exceeded)]">
                      {c.drift} {summary.driftCount}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function TraceWorkbenchCenter({
  c,
  threadId,
  taskIds,
  trace,
  entries,
  onOpenTask,
  onHighlightEntry,
  onBackToDecide,
}: {
  c: SpecStudioChrome
  threadId: string | null
  taskIds: string[]
  trace: TaskSupplyTraceItem[]
  entries: IntentLedgerEntry[]
  onOpenTask: (taskId: string) => void
  onHighlightEntry: (entryId: string) => void
  onBackToDecide: () => void
}) {
  const traceByTaskId = useMemo(() => new Map(trace.map((item) => [item.taskId, item])), [trace])
  const driftCount = entries.filter(isDriftEntry).length

  if (!threadId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-[var(--color-muted)]">
        {c.noThreadSelected}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">
        {c.traceCenterTitle}
      </h2>
      {driftCount > 0 ? (
        <p className="mt-2 rounded-md border border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 px-3 py-2 text-xs text-[var(--color-status-exceeded)]">
          {c.traceDrift}: {driftCount}
        </p>
      ) : null}
      <div className="mt-4 flex-1">
        {taskIds.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-6 text-center">
            <p className="text-sm font-medium text-[var(--color-text-strong)]">
              {c.traceEmptyTitle}
            </p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">{c.traceEmptyBody}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={onBackToDecide}
            >
              {c.traceEmptyBackToDecide}
            </Button>
          </div>
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
      </div>
    </div>
  )
}
