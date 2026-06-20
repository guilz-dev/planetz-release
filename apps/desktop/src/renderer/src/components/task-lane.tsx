import type {
  ExecutorState,
  ResultSummary,
  SkinDefinition,
  TaskResultDiffFile,
  TaskResultDiffSummary,
  TaskViewModel,
  WorkflowSummary,
} from '@planetz/shared'
import {
  FileDiff,
  GitMerge,
  GitPullRequest,
  Play,
  Plus,
  RefreshCcw,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTaskResultDiff } from '../hooks/use-task-result-diff'
import { useTickingNow } from '../hooks/use-ticking-now'
import { usePushToast } from '../hooks/use-toast'
import { useI18n, useResolvedPanelTitle } from '../i18n'
import { isOptimisticComposerTaskId } from '../lib/optimistic-composer-task.js'
import {
  normalizeWorkflowIdentifier,
  resolveWorkflowStepIndex,
} from '../lib/task-execution-display'
import { type MantaSwimmer, MantaSwimStrip } from '../skins/manta/manta-swim-strip'
import { useAppStore } from '../store/app-store'
import { PanelShell } from './panel-shell'
import type { RetryAction } from './retry-action-dialog'
import { TaskCard } from './task-card'
import { TaskCreatePrDialog } from './task-create-pr-dialog'
import { filterTasksByExecutor, filterTasksForLane, type TaskLaneFilter } from './task-lane-filters'
import { TaskPullRequestLink } from './task-result/task-pull-request-link'
import { TaskResultDiffDialog } from './task-result-diff-dialog'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Tabs } from './ui/tabs'

type Filter = TaskLaneFilter

interface TaskLaneProps {
  tasks: TaskViewModel[]
  retries: TaskViewModel[]
  results: ResultSummary[]
  executors: ExecutorState[]
  workflows: WorkflowSummary[]
  executorFilterId?: string
  selectedTaskId?: string
  skin: SkinDefinition
  onSelect: (taskId: string) => void
  onRequestRetryAction: (action: RetryAction, task: TaskViewModel) => void
  /** Stop a running task (bundled takt and mock queue). */
  onStopRunning?: (task: TaskViewModel) => Promise<void>
  /** Resume a previously stopped task (mock queue only). */
  onResumeStopped?: (task: TaskViewModel) => Promise<void>
  /** Invoked for pending tasks shown in the Queue tab. */
  onRunPending?: (task: TaskViewModel) => Promise<void>
  /** Remove a pending task from the queue (tasks.yaml or mock queue). */
  onDeletePending?: (task: TaskViewModel) => Promise<void>
  /** Open the task worktree or package directory in the system file manager. */
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
  onListResultDiff?: (input: { taskId: string; branch: string }) => Promise<TaskResultDiffSummary>
  onGetResultDiffFile?: (input: {
    taskId: string
    branch: string
    path: string
  }) => Promise<TaskResultDiffFile>
  onMerge?: (input: { taskId: string; branch: string }) => Promise<string>
  onCheckResultBranch?: (input: { taskId: string; branch: string }) => Promise<{
    exists: boolean
    defaultBaseBranch?: string
  }>
  onRefreshResultBranch?: (input: { taskId: string; branch: string }) => Promise<{
    exists: boolean
    defaultBaseBranch?: string
  }>
  onCreateResultPr?: (input: {
    taskId: string
    branch: string
    baseBranch?: string
    title?: string
    body?: string
    draft?: boolean
    pushIfNeeded?: boolean
  }) => Promise<void>
  mockQueueEnabled?: boolean
  /** Bumping this counter forces the lane to switch to the Error tab. */
  errorJumpSignal?: number
  /** Reserve scroll padding when the compose dock overlaps this column. */
  composerDockVisible?: boolean
  /** When provided, renders an "Add task" button in the header. */
  onAddTask?: () => void
  addTaskActive?: boolean
  className?: string
  onClose?: () => void
}

export function TaskLane({
  tasks,
  retries,
  results,
  executors,
  workflows,
  executorFilterId,
  selectedTaskId,
  skin,
  onSelect,
  onRequestRetryAction,
  onStopRunning,
  onResumeStopped,
  onRunPending,
  onDeletePending,
  onOpenWorkDir,
  onListResultDiff,
  onGetResultDiffFile,
  onMerge,
  onCheckResultBranch,
  onRefreshResultBranch,
  onCreateResultPr,
  mockQueueEnabled = false,
  errorJumpSignal,
  composerDockVisible = false,
  onAddTask,
  addTaskActive = false,
  className,
  onClose,
}: TaskLaneProps) {
  const title = useResolvedPanelTitle('tasks')
  const { t } = useI18n()
  const pushToast = usePushToast()
  const counterPackEnabled = useAppStore((s) => s.counterPackEnabled)
  const [filter, setFilter] = useState<Filter>('all')
  const [createPrTarget, setCreatePrTarget] = useState<{
    task: TaskViewModel
    branch: string
  } | null>(null)
  const [createPrBusy, setCreatePrBusy] = useState(false)
  const canOpenDiff = !!onListResultDiff && !!onGetResultDiffFile

  const diff = useTaskResultDiff({
    listTaskResultDiff: canOpenDiff ? onListResultDiff : undefined,
    getTaskResultDiffFile: canOpenDiff ? onGetResultDiffFile : undefined,
    onOpenWorkDir,
  })

  useEffect(() => {
    if (errorJumpSignal === undefined || errorJumpSignal === 0) return
    setFilter('error')
  }, [errorJumpSignal])

  const filtered = useMemo(() => {
    const byTab = filterTasksForLane(tasks, filter)
    return filterTasksByExecutor(byTab, executorFilterId, executors)
  }, [tasks, filter, executorFilterId, executors])

  const executorFilter = useMemo(
    () => (executorFilterId ? executors.find((e) => e.id === executorFilterId) : undefined),
    [executorFilterId, executors],
  )

  const resultByTaskId = useMemo(() => {
    const m = new Map<string, ResultSummary>()
    for (const r of results) m.set(r.taskId, r)
    return m
  }, [results])

  const counts = useMemo(
    () => ({
      active: tasks.filter((t) => t.status === 'running').length,
      queue: tasks.filter((t) => t.status === 'pending' || t.status === 'stopped').length,
      error: retries.length,
    }),
    [tasks, retries],
  )

  const workflowsByName = useMemo(() => new Map(workflows.map((w) => [w.name, w])), [workflows])
  const hasRunning = counts.active > 0
  const now = useTickingNow(10_000, hasRunning)

  // The swim strip shows the whole active squad (all running tasks), regardless
  // of the current tab. x position = step progress; label = task id.
  const swimmers = useMemo<MantaSwimmer[]>(() => {
    if (!counterPackEnabled) return []
    return tasks
      .filter((t) => t.status === 'running')
      .map((t) => {
        const wfName = normalizeWorkflowIdentifier(t.workflow)
        const wf = wfName ? workflowsByName.get(wfName) : undefined
        const total = wf?.stepNames.length ?? 0
        const idx = resolveWorkflowStepIndex(wf, t.activeStep)
        const progress = total > 0 ? Math.max(0, idx) / total : 0
        return { id: t.id, label: t.id, status: 'working', progress }
      })
  }, [counterPackEnabled, tasks, workflowsByName])

  const subtitle = useMemo(() => {
    const base =
      filter === 'error'
        ? `${counts.error} need attention`
        : `${counts.active} running · ${counts.queue} queued`
    if (!executorFilter) return base
    return `${executorFilter.displayName} · ${filtered.length} shown · ${base}`
  }, [filter, counts, executorFilter, filtered.length])

  return (
    <PanelShell
      title={title}
      subtitle={subtitle}
      className={className}
      bodyClassName={cn(composerDockVisible && 'pb-44')}
      onClose={onClose}
      actions={
        <div className="flex items-center gap-1.5">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'queue', label: 'Queue' },
              { value: 'done', label: 'Done' },
              {
                value: 'error',
                label: counts.error > 0 ? `Error (${counts.error})` : 'Error',
              },
            ]}
          />
          {onAddTask ? (
            <Button
              type="button"
              variant={addTaskActive ? 'subtle' : 'secondary'}
              size="sm"
              leading={<Plus size={13} />}
              onClick={onAddTask}
            >
              Add task
            </Button>
          ) : null}
        </div>
      }
    >
      {counterPackEnabled ? (
        <div className="sticky top-0 z-10 mb-2 -mx-1 bg-[var(--color-surface)]/80 px-1 pb-1 backdrop-blur-sm">
          <MantaSwimStrip swimmers={swimmers} selectedId={selectedTaskId} onSelect={onSelect} />
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--color-muted)]">
          {executorFilter
            ? `No tasks for ${executorFilter.displayName} in this view`
            : 'No tasks for this view'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((task) => {
            const optimisticTask = isOptimisticComposerTaskId(task.id)
            const workflowName = normalizeWorkflowIdentifier(task.workflow)
            return (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  selected={task.id === selectedTaskId}
                  skin={skin}
                  workflow={workflowName ? workflowsByName.get(workflowName) : undefined}
                  workflows={workflows}
                  executors={executors}
                  now={now}
                  onSelect={() => {
                    if (optimisticTask) return
                    onSelect(task.id)
                  }}
                  onOpenWorkDir={onOpenWorkDir}
                />
                {!optimisticTask &&
                (filter === 'done' || filter === 'all') &&
                task.status === 'completed' ? (
                  <DoneActions
                    task={task}
                    result={resultByTaskId.get(task.id)}
                    onMerge={onMerge}
                    onOpenDiff={
                      canOpenDiff
                        ? (selectedTask, branch) => void diff.openDiff(selectedTask, branch)
                        : undefined
                    }
                    onCheckResultBranch={onCheckResultBranch}
                    onRefreshResultBranch={onRefreshResultBranch}
                    onOpenCreatePr={
                      !mockQueueEnabled && onCreateResultPr
                        ? (selectedTask, branch) =>
                            setCreatePrTarget({ task: selectedTask, branch })
                        : undefined
                    }
                  />
                ) : null}
                {!optimisticTask && filter === 'error' ? (
                  <ErrorRecoveryActions task={task} onRequestAction={onRequestRetryAction} />
                ) : null}
                {!optimisticTask &&
                (filter === 'active' || filter === 'all') &&
                onStopRunning &&
                task.status === 'running' ? (
                  <RunningStopActions task={task} onStopRunning={onStopRunning} />
                ) : null}
                {!optimisticTask &&
                (filter === 'queue' || filter === 'all') &&
                (onRunPending || onResumeStopped || onDeletePending) ? (
                  <QueueTaskActions
                    task={task}
                    onRunPending={onRunPending}
                    onResumeStopped={onResumeStopped}
                    onDeletePending={onDeletePending}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <TaskResultDiffDialog
        open={diff.open}
        onClose={diff.closeDiff}
        summary={diff.summary}
        fileContent={diff.fileContent}
        selectedPath={diff.selectedPath}
        onSelectFile={(path) => void diff.selectFile(path)}
        viewMode={diff.viewMode}
        onViewModeChange={diff.setViewMode}
        loadingFile={diff.loadingFile}
        branchMissing={diff.branchMissing}
        onOpenWorktree={() => void diff.openWorkDir()}
      />
      {createPrTarget && onCreateResultPr && onCheckResultBranch ? (
        <TaskCreatePrDialog
          open={Boolean(createPrTarget)}
          taskId={createPrTarget.task.id}
          branch={createPrTarget.branch}
          defaultTitle={createPrTarget.task.title}
          busy={createPrBusy}
          onClose={() => {
            if (createPrBusy) return
            setCreatePrTarget(null)
          }}
          checkBranch={onCheckResultBranch}
          onBranchUnavailable={() => {
            pushToast({
              kind: 'warn',
              title: t('panels.result.createPrDisabled'),
              message: t('panels.result.createPrDisabled'),
            })
          }}
          onSubmit={async (input) => {
            setCreatePrBusy(true)
            try {
              await onCreateResultPr({
                taskId: createPrTarget.task.id,
                branch: createPrTarget.branch,
                ...input,
              })
              setCreatePrTarget(null)
            } finally {
              setCreatePrBusy(false)
            }
          }}
        />
      ) : null}
    </PanelShell>
  )
}

function DoneActions({
  task,
  result,
  onMerge,
  onOpenDiff,
  onCheckResultBranch,
  onRefreshResultBranch,
  onOpenCreatePr,
}: {
  task: TaskViewModel
  result: ResultSummary | undefined
  onMerge?: (input: { taskId: string; branch: string }) => Promise<string>
  /** Opens the rich diff dialog. */
  onOpenDiff?: (task: TaskViewModel, branch: string) => void
  onCheckResultBranch?: (input: { taskId: string; branch: string }) => Promise<{
    exists: boolean
    defaultBaseBranch?: string
  }>
  onRefreshResultBranch?: (input: { taskId: string; branch: string }) => Promise<{
    exists: boolean
    defaultBaseBranch?: string
  }>
  onOpenCreatePr?: (task: TaskViewModel, branch: string) => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [branchExists, setBranchExists] = useState<boolean | null>(null)
  const branch = result?.branch ?? task.sourceBranch
  const showActions =
    branch && result?.status === 'completed' && (onOpenDiff || onMerge || onOpenCreatePr)

  useEffect(() => {
    if (!branch || !onCheckResultBranch || result?.status !== 'completed') {
      setBranchExists(null)
      return
    }
    let cancelled = false
    void onCheckResultBranch({ taskId: task.id, branch })
      .then((check) => {
        if (!cancelled) setBranchExists(check.exists)
      })
      .catch(() => {
        if (!cancelled) setBranchExists(false)
      })
    return () => {
      cancelled = true
    }
  }, [branch, onCheckResultBranch, result?.status, task.id])

  if (!showActions || !branch) return null

  async function run(
    op: ((input: { taskId: string; branch: string }) => Promise<string>) | undefined,
    confirmText?: string,
    refreshBranchAfter = false,
  ) {
    if (!op || !branch) return
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setMessage(null)
    try {
      const output = await op({ taskId: task.id, branch })
      setMessage(output.trim() || 'Done.')
      if (refreshBranchAfter && onRefreshResultBranch) {
        const check = await onRefreshResultBranch({ taskId: task.id, branch })
        setBranchExists(check.exists)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const createPrDisabled = branchExists === false
  const showCreatePr = onOpenCreatePr && !result?.pullRequest

  return (
    <div className="mt-1 flex flex-col gap-1 px-2">
      <div className="flex flex-wrap items-center gap-1">
        {result?.pullRequest ? (
          <TaskPullRequestLink pullRequest={result.pullRequest} className="mr-1" />
        ) : null}
        {onOpenDiff ? (
          <Button
            size="sm"
            variant="ghost"
            leading={<FileDiff size={11} />}
            disabled={busy}
            onClick={() => {
              if (!branch) return
              onOpenDiff(task, branch)
            }}
          >
            Diff
          </Button>
        ) : null}
        {showCreatePr ? (
          <Button
            size="sm"
            variant="ghost"
            leading={<GitPullRequest size={11} />}
            disabled={busy || createPrDisabled}
            title={createPrDisabled ? t('panels.result.createPrDisabled') : undefined}
            onClick={() => onOpenCreatePr(task, branch)}
          >
            {t('panels.result.createPr')}
          </Button>
        ) : null}
        {onMerge ? (
          <Button
            size="sm"
            variant="ghost"
            leading={<GitMerge size={11} />}
            disabled={busy}
            onClick={() =>
              void run(onMerge, t('panels.result.mergeLocalConfirm', { branch }), true)
            }
          >
            {t('panels.result.mergeLocal')}
          </Button>
        ) : null}
      </div>
      {message ? (
        <pre
          className={cn(
            'max-h-20 overflow-auto rounded border border-[var(--color-border)]',
            'bg-[var(--color-surface)]/60 p-2 font-mono text-[10px] whitespace-pre-wrap',
            'text-[var(--color-muted-strong)]',
          )}
        >
          {message}
        </pre>
      ) : null}
    </div>
  )
}

function ErrorRecoveryActions({
  task,
  onRequestAction,
}: {
  task: TaskViewModel
  onRequestAction: (action: RetryAction, task: TaskViewModel) => void
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1 px-2">
      <Button
        size="sm"
        variant="subtle"
        leading={<RefreshCcw size={11} />}
        onClick={() => onRequestAction('retry', task)}
      >
        Retry
      </Button>
      <Button
        size="sm"
        variant="secondary"
        leading={<Sparkles size={11} />}
        onClick={() => onRequestAction('resume', task)}
      >
        Resume
      </Button>
    </div>
  )
}

function RunningStopActions({
  task,
  onStopRunning,
}: {
  task: TaskViewModel
  onStopRunning: (task: TaskViewModel) => Promise<void>
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onStopRunning(task)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1 px-2">
      <Button
        size="sm"
        variant="subtle"
        leading={<Square size={11} />}
        disabled={busy}
        aria-label={t('panels.running.stopAria')}
        onClick={() => void handleClick()}
      >
        {t('panels.running.stop')}
      </Button>
    </div>
  )
}

function QueueTaskActions({
  task,
  onRunPending,
  onResumeStopped,
  onDeletePending,
}: {
  task: TaskViewModel
  onRunPending?: (task: TaskViewModel) => Promise<void>
  onResumeStopped?: (task: TaskViewModel) => Promise<void>
  onDeletePending?: (task: TaskViewModel) => Promise<void>
}) {
  const { t } = useI18n()
  const [runBusy, setRunBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const showRun =
    (task.status === 'pending' && onRunPending) || (task.status === 'stopped' && onResumeStopped)
  const showDelete = task.status === 'pending' && onDeletePending
  if (!showRun && !showDelete) return null

  const buttonLabel =
    task.status === 'stopped' ? t('panels.pending.resume') : t('panels.pending.run')
  const buttonAria =
    task.status === 'stopped' ? t('panels.pending.resumeAria') : t('panels.pending.runAria')
  const buttonIcon = task.status === 'stopped' ? <RefreshCcw size={11} /> : <Play size={11} />

  const handleRun = async () => {
    if (runBusy) return
    setRunBusy(true)
    try {
      if (task.status === 'pending' && onRunPending) {
        await onRunPending(task)
        return
      }
      if (task.status === 'stopped' && onResumeStopped) {
        await onResumeStopped(task)
      }
    } finally {
      setRunBusy(false)
    }
  }

  const handleDelete = async () => {
    if (deleteBusy || !onDeletePending) return
    setDeleteBusy(true)
    try {
      await onDeletePending(task)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1 px-2">
      {showRun ? (
        <Button
          size="sm"
          variant="subtle"
          leading={buttonIcon}
          disabled={runBusy || deleteBusy}
          aria-label={buttonAria}
          onClick={() => void handleRun()}
        >
          {buttonLabel}
        </Button>
      ) : null}
      {showDelete ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-[var(--color-status-failed)] hover:text-[var(--color-status-failed)]"
          leading={<Trash2 size={11} />}
          disabled={runBusy || deleteBusy}
          aria-label={t('panels.pending.deleteAria')}
          onClick={() => void handleDelete()}
        >
          {t('panels.pending.delete')}
        </Button>
      ) : null}
    </div>
  )
}
