import type {
  ChainEdge,
  ChainGroup,
  ExecutorState,
  ResultSummary,
  TaskViewModel,
  WorkflowSummary,
} from '@planetz/shared'
import { isTerminalTaskStatus } from '@planetz/shared'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  GitBranch,
  Hash,
  Maximize2,
  MessageSquare,
  Play,
  RefreshCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePendingDecisionCount } from '../hooks/use-intent-ledger-queue'
import { useTickingNow } from '../hooks/use-ticking-now'
import { useI18n, useResolvedPanelTitle } from '../i18n'
import { normalizeWorkflowIdentifier } from '../lib/task-execution-display'
import { useSkin } from '../skins/context'
import { ChainEdges } from './chain-edges'
import { ConversationTimeline } from './conversation-timeline'
import { DetailTaskActionButton } from './detail-task-action-button'
import { PanelShell } from './panel-shell'
import type { RetryAction } from './retry-action-dialog'
import { TaskBranchLink } from './task-branch-link'
import { TaskExecutionStatusPanel } from './task-execution-status-panel'
import { TaskFailurePanel } from './task-failure-panel'
import { TaskLiveMetaRow } from './task-live-meta-row'
import { TaskResultSection } from './task-result-section'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Dialog } from './ui/dialog'
import { StatusDot } from './ui/status-dot'
import { WorkflowStepList } from './workflow-step-list'

interface DetailPanelProps {
  task: TaskViewModel | undefined
  tasks: TaskViewModel[]
  results: ResultSummary[]
  workflows: WorkflowSummary[]
  executors: ExecutorState[]
  chains: ChainGroup[]
  className?: string
  /** Reserve scroll padding when the compose dock overlaps the detail column. */
  composerDockVisible?: boolean
  onSelectTask: (taskId: string) => void
  /** When provided, renders a back arrow that clears the task selection. */
  onBack?: () => void
  onCreateChain: () => void
  onMaterializeChain: (input: { chainId: string; fromTaskId: string }) => void
  onUnlinkChainEdge: (chainId: string, edge: ChainEdge) => void
  chainMaterializeBusy?: boolean
  chainMaterializeWarning?: string | null
  onClose?: () => void
  /** Jump to the execution log view with filters preset for this task. */
  onOpenExecutionLog?: (task: TaskViewModel) => void
  /** Jump to Decisions with this task's pending assumptions. */
  onOpenDecisions?: (task: TaskViewModel) => void
  /** Open the retry/resume dialog for the given task. */
  onRequestRetryAction?: (action: RetryAction, task: TaskViewModel) => void
  /** Trigger immediate execution of a pending task. */
  onRunPending?: (task: TaskViewModel) => Promise<void>
  /** Remove a pending task from the queue (tasks.yaml or mock queue). */
  onDeletePending?: (task: TaskViewModel) => Promise<void>
  /** Stop a running task (bundled takt and mock queue). */
  onStopRunning?: (task: TaskViewModel) => Promise<void>
  /** Resume a previously stopped task (mock queue only). */
  onResumeStopped?: (task: TaskViewModel) => Promise<void>
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
  /** When true, show Continue in Chat for Conversation Mode. */
  conversationChatEnabled?: boolean
  onContinueInChat?: (task: TaskViewModel) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const STATUS_BADGE_TONE: Record<
  TaskViewModel['status'],
  'pending' | 'running' | 'stopped' | 'completed' | 'failed' | 'exceeded'
> = {
  pending: 'pending',
  running: 'running',
  stopped: 'stopped',
  completed: 'completed',
  failed: 'failed',
  exceeded: 'exceeded',
}

export function DetailPanel({
  task,
  tasks,
  results,
  workflows,
  executors,
  chains,
  className,
  composerDockVisible = false,
  onSelectTask,
  onBack,
  onCreateChain,
  onMaterializeChain,
  onUnlinkChainEdge,
  chainMaterializeBusy,
  chainMaterializeWarning,
  onClose,
  onOpenExecutionLog,
  onOpenDecisions,
  onRequestRetryAction,
  onRunPending,
  onDeletePending,
  onStopRunning,
  onResumeStopped,
  onOpenWorkDir,
  conversationChatEnabled = false,
  onContinueInChat,
}: DetailPanelProps) {
  const { t } = useI18n()
  const skin = useSkin()
  const detailTitle = useResolvedPanelTitle('detail')
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const resultsByTaskId = useMemo(() => new Map(results.map((r) => [r.taskId, r])), [results])
  const live = task?.status === 'running'
  const terminal = task ? isTerminalTaskStatus(task.status) : false
  const now = useTickingNow(1_000, live)
  const [expanded, setExpanded] = useState(false)
  const pendingDecisionCount = usePendingDecisionCount(task?.id, {
    enabled: Boolean(onOpenDecisions),
  })

  if (!task) {
    return (
      <PanelShell title={detailTitle} className={className} onClose={onClose}>
        <p className="px-1 py-6 text-center text-xs text-[var(--color-muted)]">
          {t('panels.detailEmpty')}
        </p>
      </PanelShell>
    )
  }

  const workflowName = normalizeWorkflowIdentifier(task.workflow)
  const workflow = workflowName ? workflows.find((w) => w.name === workflowName) : undefined
  const statusLabel = skin.taskStatusLabel?.(task.status) ?? task.status
  const statusBadgeTone = STATUS_BADGE_TONE[task.status]
  const elapsedMs = now - Date.parse(task.updatedAt)

  const detailBody = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusBadgeTone} leading={<StatusDot tone={task.status} pulse={live} />}>
          {statusLabel}
        </Badge>
        <Badge tone="neutral">{task.priority}</Badge>
        {task.assignedAgentId ? <Badge tone="accent">{task.assignedAgentId}</Badge> : null}
      </div>

      {task.failure ? (
        <TaskFailurePanel
          task={task}
          failure={task.failure}
          onRequestRetryAction={onRequestRetryAction}
          onOpenExecutionLog={onOpenExecutionLog}
        />
      ) : null}

      {terminal ? (
        <TaskResultSection
          task={task}
          result={resultsByTaskId.get(task.id)}
          onOpenExecutionLog={onOpenExecutionLog}
          onOpenWorkDir={onOpenWorkDir}
        />
      ) : null}

      {task.status === 'pending' && (onRunPending || onDeletePending) ? (
        <div className="flex flex-wrap gap-2">
          {onRunPending ? (
            <DetailTaskActionButton
              task={task}
              onAction={onRunPending}
              label={t('panels.pending.run')}
              ariaLabel={t('panels.pending.runAria')}
              leading={<Play size={12} />}
            />
          ) : null}
          {onDeletePending ? (
            <DetailTaskActionButton
              task={task}
              onAction={onDeletePending}
              label={t('panels.pending.delete')}
              ariaLabel={t('panels.pending.deleteAria')}
              leading={<Trash2 size={12} />}
              variant="ghost"
              className="self-start text-[var(--color-status-failed)] hover:text-[var(--color-status-failed)]"
            />
          ) : null}
        </div>
      ) : null}
      {task.status === 'running' && onStopRunning ? (
        <DetailTaskActionButton
          task={task}
          onAction={onStopRunning}
          label={t('panels.running.stop')}
          ariaLabel={t('panels.running.stopAria')}
          leading={<Square size={12} />}
        />
      ) : null}
      {task.status === 'stopped' && onResumeStopped ? (
        <DetailTaskActionButton
          task={task}
          onAction={onResumeStopped}
          label={t('panels.pending.resume')}
          ariaLabel={t('panels.pending.resumeAria')}
          leading={<RefreshCcw size={12} />}
        />
      ) : null}

      {live && !terminal ? (
        <>
          <TaskExecutionStatusPanel task={task} />
          {workflowName && !workflow ? (
            <p className="text-xs text-[var(--color-status-exceeded)]">
              {t('panels.running.liveNoWorkflow', { name: workflowName })}
            </p>
          ) : null}
        </>
      ) : null}

      {workflow && !terminal ? (
        <section
          aria-label={t('panels.running.workflowProgressAria')}
          className={cn(
            'flex flex-col gap-3 rounded-md border p-2.5',
            live
              ? 'border-[var(--color-status-running)]/30 bg-[var(--color-status-running-soft)]/30'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]/40',
          )}
        >
          <WorkflowStepList
            workflow={workflow}
            activeStep={task.activeStep}
            live={live}
            stepActivities={task.workflowStepActivities}
          />
        </section>
      ) : null}

      {live && !terminal ? (
        <TaskLiveMetaRow task={task} executors={executors} elapsedMs={elapsedMs} />
      ) : null}

      {task.body ? (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            order.md
          </p>
          <pre className="max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-[var(--color-text)]">
            {task.body}
          </pre>
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="flex items-center gap-1 text-[var(--color-muted)]">
          <Hash size={11} />
          id
        </dt>
        <dd className="font-mono text-[var(--color-text)]">{task.id}</dd>
        {!live && task.activeRunId ? (
          <>
            <dt className="text-[var(--color-muted)]">run</dt>
            <dd className="truncate font-mono text-[var(--color-muted-strong)]">
              {task.activeRunId}
            </dd>
          </>
        ) : null}
        {task.sourceBranch ? (
          <>
            <dt className="flex items-center gap-1 text-[var(--color-muted)]">
              <GitBranch size={11} />
              branch
            </dt>
            <dd className="min-w-0 overflow-hidden font-mono text-[var(--color-text)]">
              <TaskBranchLink task={task} onOpenWorkDir={onOpenWorkDir} />
            </dd>
          </>
        ) : null}
        <dt className="flex items-center gap-1 text-[var(--color-muted)]">
          <Clock size={11} />
          updated
        </dt>
        <dd className="text-[var(--color-text)]">{formatTime(task.updatedAt)}</dd>
      </dl>

      {onOpenExecutionLog && !task.failure ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          leading={<ExternalLink size={12} />}
          onClick={() => onOpenExecutionLog(task)}
        >
          {t('panels.running.openInLog')}
        </Button>
      ) : null}

      {onOpenDecisions && pendingDecisionCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onOpenDecisions(task)}
        >
          {t('panels.detailOpenDecisions', { count: String(pendingDecisionCount) })}
        </Button>
      ) : null}

      {conversationChatEnabled && onContinueInChat ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          leading={<MessageSquare size={12} />}
          title={t('panels.continueInChatHint')}
          onClick={() => onContinueInChat(task)}
        >
          {t('panels.continueInChat')}
        </Button>
      ) : null}

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
          Conversation
        </p>
        <ConversationTimeline taskId={task.id} />
      </div>

      <ChainEdges
        task={task}
        chains={chains}
        tasksById={tasksById}
        onCreateChain={onCreateChain}
        onMaterialize={onMaterializeChain}
        onSelectTask={onSelectTask}
        onUnlink={onUnlinkChainEdge}
        materializeBusy={chainMaterializeBusy}
        materializeWarning={chainMaterializeWarning}
      />
    </div>
  )

  const expandButton = (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      aria-label={t('panels.detailExpandAria')}
      className="inline-flex size-6 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
    >
      <Maximize2 size={13} />
    </button>
  )

  return (
    <>
      <PanelShell
        title={detailTitle}
        subtitle={task.title}
        className={className}
        bodyClassName={cn(composerDockVisible && 'pb-44')}
        onClose={onClose}
        actions={
          <>
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<ArrowLeft size={12} />}
                onClick={onBack}
                aria-label={t('panels.detailBackAria')}
              >
                {t('panels.detailBack')}
              </Button>
            ) : null}
            {expandButton}
          </>
        }
      >
        {expanded ? null : detailBody}
      </PanelShell>
      {expanded ? (
        <Dialog
          open
          onClose={() => setExpanded(false)}
          size="full"
          title={detailTitle}
          description={task.title}
        >
          {detailBody}
        </Dialog>
      ) : null}
    </>
  )
}
