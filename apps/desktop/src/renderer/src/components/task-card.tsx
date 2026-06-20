import type {
  ExecutorState,
  SkinDefinition,
  TaskStatus,
  TaskViewModel,
  WorkflowSummary,
} from '@planetz/shared'
import { ArrowRight, Flag, Link2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { useTaskIcon } from '../skins/use-task-icon'
import { TaskBranchLink } from './task-branch-link'
import { TaskCardFailureMeta } from './task-card-failure-meta'
import { TaskCardRunningProgress } from './task-card-running-progress'
import { Badge } from './ui/badge'
import { cn } from './ui/cn'
import { StatusDot } from './ui/status-dot'
import { TaskWorkflowBadge } from './workflow-selection/task-workflow-badge.js'
import { TaskWorkflowSwap } from './workflow-selection/task-workflow-swap.js'

const PRIORITY_TONE = {
  low: 'neutral',
  normal: 'neutral',
  high: 'exceeded',
  urgent: 'failed',
} as const

const STATUS_TONE: Record<
  TaskStatus,
  'pending' | 'running' | 'stopped' | 'completed' | 'failed' | 'exceeded'
> = {
  pending: 'pending',
  running: 'running',
  stopped: 'stopped',
  completed: 'completed',
  failed: 'failed',
  exceeded: 'exceeded',
}

interface TaskCardProps {
  task: TaskViewModel
  selected: boolean
  skin: SkinDefinition
  workflow?: WorkflowSummary
  workflows?: WorkflowSummary[]
  executors?: ExecutorState[]
  now?: number
  onSelect: () => void
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}

export function TaskCard({
  task,
  selected,
  skin,
  workflow,
  workflows,
  executors,
  now,
  onSelect,
  onOpenWorkDir,
}: TaskCardProps) {
  const { t } = useI18n()
  const visual = skin.mapTaskVisual(task)
  const statusLabel = skin.taskStatusLabel?.(task.status) ?? task.status
  const SizeIcon = useTaskIcon(visual.iconId)
  const isRunning = task.status === 'running'
  const isFailed = task.status === 'failed' || task.status === 'exceeded'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group w-full cursor-default overflow-hidden rounded-lg border bg-[var(--color-surface-elevated)]/60 text-left transition-all',
        selected
          ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${visual.accentToken}` }}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="mt-1 flex flex-col items-center gap-1">
          {/* Running tasks swim as mantas in the MantaSwimStrip above the list;
              the row keeps a plain status dot. */}
          <StatusDot tone={task.status} pulse={isRunning} />
          {SizeIcon ? (
            <SizeIcon
              width={priorityIconSize(visual.iconId)}
              height={priorityIconSize(visual.iconId)}
              style={{ color: visual.accentToken }}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium text-[var(--color-text)]">
              {visual.label}
            </h3>
            <Badge tone={STATUS_TONE[task.status]}>{statusLabel}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1">
              <Flag size={10} />
              <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
            </span>
            {task.status === 'pending' && workflows && workflows.length > 0 ? (
              <TaskWorkflowSwap
                taskId={task.id}
                workflow={task.workflow}
                selection={task.workflowSelection}
                workflows={workflows}
              />
            ) : (
              <TaskWorkflowBadge workflow={task.workflow} selection={task.workflowSelection} />
            )}
            {task.assignedAgentId ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <ArrowRight size={10} />
                {task.assignedAgentId}
              </span>
            ) : null}
            <TaskBranchLink task={task} onOpenWorkDir={onOpenWorkDir} />
            {task.chainId || task.dependsOnTaskId ? (
              <span
                className="inline-flex items-center gap-1 text-[var(--color-accent)]"
                title={t('panels.running.chainPart')}
              >
                <Link2 size={10} />
                {task.dependsOnTaskId ? (
                  <span className="font-mono">{task.dependsOnTaskId}</span>
                ) : (
                  t('panels.running.chain')
                )}
              </span>
            ) : null}
          </div>
          {isRunning ? (
            <TaskCardRunningProgress
              task={task}
              workflow={workflow}
              executors={executors}
              now={now}
            />
          ) : null}
          {isFailed && task.failure ? (
            <TaskCardFailureMeta
              failure={task.failure}
              statusReason={task.statusReason}
              rawStatus={task.rawStatus}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function priorityIconSize(iconId: string | undefined): number {
  switch (iconId) {
    case 'small':
      return 10
    case 'medium':
      return 12
    case 'large':
      return 14
    case 'jumbo':
      return 16
    default:
      return 12
  }
}
