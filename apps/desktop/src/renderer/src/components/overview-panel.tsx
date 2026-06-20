import type { ChainGroup, ResultSummary, TaskViewModel, WorkflowSummary } from '@planetz/shared'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  Link2,
  RefreshCcw,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useResolvedPanelTitle } from '../i18n'
import { formatElapsed } from '../lib/format-elapsed'
import { PanelShell } from './panel-shell'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from './ui/cn'

const RUNNING_STALE_MS = 5 * 60 * 1000
const QUEUED_STALE_MS = 10 * 60 * 1000

interface OverviewPanelProps {
  tasks: TaskViewModel[]
  retries: TaskViewModel[]
  results: ResultSummary[]
  chains: ChainGroup[]
  workflows: WorkflowSummary[]
  executorsIdle: number
  executorsTotal: number
  className?: string
  /** Reserve scroll padding when the compose dock overlaps this column. */
  composerDockVisible?: boolean
  onSelectTask: (taskId: string) => void
  onJumpErrorTab: () => void
  onOpenSettings?: () => void
  onClose?: () => void
}

export function OverviewPanel({
  tasks,
  retries,
  results,
  chains,
  workflows,
  executorsIdle,
  executorsTotal,
  className,
  composerDockVisible = false,
  onSelectTask,
  onJumpErrorTab,
  onOpenSettings,
  onClose,
}: OverviewPanelProps) {
  const title = useResolvedPanelTitle('overview')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const longRunning = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'running' && now - Date.parse(t.updatedAt) > RUNNING_STALE_MS,
      ),
    [tasks, now],
  )
  const stuckQueued = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'pending' && now - Date.parse(t.createdAt) > QUEUED_STALE_MS,
      ),
    [tasks, now],
  )

  const chainsReady = useMemo(() => {
    const list: { chainId: string; fromTaskId: string; title: string }[] = []
    const byId = new Map(tasks.map((t) => [t.id, t]))
    for (const chain of chains) {
      for (const edge of chain.edges) {
        if (edge.status === 'ready_to_create') {
          const from = byId.get(edge.fromTaskId)
          list.push({
            chainId: chain.id,
            fromTaskId: edge.fromTaskId,
            title: from?.title ?? edge.fromTaskId,
          })
        }
      }
    }
    return list
  }, [chains, tasks])

  const mergesReady = useMemo(
    () => results.filter((r) => r.status === 'completed' && !!r.branch),
    [results],
  )

  const workflowErrors = useMemo(
    () => workflows.filter((w) => w.diagnostics.some((d) => d.level === 'error')),
    [workflows],
  )

  const recent = useMemo(() => results.slice(0, 5), [results])

  const hasNeedsAttention =
    retries.length > 0 ||
    chainsReady.length > 0 ||
    mergesReady.length > 0 ||
    workflowErrors.length > 0

  const hasLiveSignal = longRunning.length > 0 || stuckQueued.length > 0 || executorsTotal > 0

  const empty = !hasNeedsAttention && !hasLiveSignal && recent.length === 0

  return (
    <PanelShell
      title={title}
      density="compact"
      className={className}
      bodyClassName={cn(composerDockVisible && 'pb-44')}
      onClose={onClose}
    >
      {empty ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--color-muted)]">
          Nothing to surface yet. Activity will appear here as tasks run.
        </p>
      ) : null}

      {hasNeedsAttention ? (
        <Section
          icon={<AlertTriangle size={11} className="text-[var(--color-status-exceeded)]" />}
          title="Needs attention"
        >
          {retries.length > 0 ? (
            <SectionRow
              label={
                <span className="inline-flex items-center gap-1">
                  <RefreshCcw size={11} />
                  {retries.length} {retries.length === 1 ? 'error' : 'errors'}
                </span>
              }
              hint={retries[0]?.title}
            >
              <Button size="sm" variant="subtle" onClick={onJumpErrorTab}>
                Open
              </Button>
            </SectionRow>
          ) : null}

          {chainsReady.length > 0 ? (
            <SectionRow
              label={
                <span className="inline-flex items-center gap-1">
                  <Link2 size={11} />
                  {chainsReady.length} chain{chainsReady.length === 1 ? '' : 's'} ready
                </span>
              }
              hint={chainsReady[0]?.title}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={() => chainsReady[0] && onSelectTask(chainsReady[0].fromTaskId)}
              >
                Review
              </Button>
            </SectionRow>
          ) : null}

          {mergesReady.length > 0 ? (
            <SectionRow
              label={
                <span className="inline-flex items-center gap-1">
                  <GitBranch size={11} />
                  {mergesReady.length} merge{mergesReady.length === 1 ? '' : 's'} ready
                </span>
              }
              hint={mergesReady[0]?.title}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={() => mergesReady[0] && onSelectTask(mergesReady[0].taskId)}
              >
                Open
              </Button>
            </SectionRow>
          ) : null}

          {workflowErrors.length > 0 ? (
            <SectionRow
              label={
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert size={11} className="text-[var(--color-status-failed)]" />
                  {workflowErrors.length} workflow error
                  {workflowErrors.length === 1 ? '' : 's'}
                </span>
              }
              hint={workflowErrors[0]?.name}
            >
              {onOpenSettings ? (
                <Button size="sm" variant="ghost" onClick={onOpenSettings}>
                  Fix
                </Button>
              ) : null}
            </SectionRow>
          ) : null}
        </Section>
      ) : null}

      {hasLiveSignal ? (
        <Section
          icon={<Timer size={11} className="text-[var(--color-status-running)]" />}
          title="Live"
        >
          {longRunning.length > 0 ? (
            <LiveTaskList
              label={`Running > 5m`}
              tasks={longRunning}
              now={now}
              onSelect={onSelectTask}
            />
          ) : (
            <SectionRow label={<span className="text-[var(--color-muted)]">Running &gt; 5m</span>}>
              <span className="text-[11px] text-[var(--color-muted)]">0</span>
            </SectionRow>
          )}
          {stuckQueued.length > 0 ? (
            <LiveTaskList
              label={`Queued > 10m`}
              tasks={stuckQueued}
              now={now}
              onSelect={onSelectTask}
              tone="exceeded"
            />
          ) : (
            <SectionRow label={<span className="text-[var(--color-muted)]">Queued &gt; 10m</span>}>
              <span className="text-[11px] text-[var(--color-muted)]">0</span>
            </SectionRow>
          )}
          {executorsTotal > 0 ? (
            <SectionRow label={<span className="text-[var(--color-muted)]">Executors idle</span>}>
              <span className="text-[11px] tabular-nums text-[var(--color-text)]">
                {executorsIdle} / {executorsTotal}
              </span>
            </SectionRow>
          ) : null}
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section icon={<Clock size={11} className="text-[var(--color-muted)]" />} title="Recent">
          <ul className="flex flex-col gap-1">
            {recent.map((r) => (
              <li key={r.taskId}>
                <RecentRow result={r} now={now} onSelect={() => onSelectTask(r.taskId)} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </PanelShell>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2">
      <header className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        {icon}
        {title}
      </header>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function SectionRow({
  label,
  hint,
  children,
}: {
  label: React.ReactNode
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text)]">
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {hint ? <div className="truncate text-[11px] text-[var(--color-muted)]">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}

function LiveTaskList({
  label,
  tasks,
  now,
  onSelect,
  tone = 'running',
}: {
  label: string
  tasks: TaskViewModel[]
  now: number
  onSelect: (taskId: string) => void
  tone?: 'running' | 'exceeded'
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
        <span>{label}</span>
        <Badge tone={tone}>{tasks.length}</Badge>
      </div>
      <ul className="flex flex-col gap-1">
        {tasks.slice(0, 3).map((task) => {
          const elapsed =
            now - Date.parse(task.status === 'pending' ? task.createdAt : task.updatedAt)
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left',
                  'hover:bg-[var(--color-panel-strong)]',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text)]">
                  {task.title}
                  {task.activeStep ? (
                    <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted-strong)]">
                      · {task.activeStep}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
                  {formatElapsed(elapsed)}
                </span>
              </button>
            </li>
          )
        })}
        {tasks.length > 3 ? (
          <li className="px-2 text-[10px] text-[var(--color-muted)]">+{tasks.length - 3} more</li>
        ) : null}
      </ul>
    </div>
  )
}

function RecentRow({
  result,
  now,
  onSelect,
}: {
  result: ResultSummary
  now: number
  onSelect: () => void
}) {
  const completedAt = result.completedAt ? Date.parse(result.completedAt) : null
  const elapsed = completedAt != null ? now - completedAt : null
  const icon =
    result.status === 'completed' ? (
      <CheckCircle2 size={11} className="text-[var(--color-status-completed)]" />
    ) : result.status === 'failed' ? (
      <TriangleAlert size={11} className="text-[var(--color-status-failed)]" />
    ) : (
      <AlertTriangle size={11} className="text-[var(--color-status-exceeded)]" />
    )
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left',
        'hover:bg-[var(--color-panel-strong)]',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {icon}
        <span className="truncate text-xs text-[var(--color-text)]">{result.title}</span>
      </span>
      {elapsed != null ? (
        <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
          {formatElapsed(elapsed)}
        </span>
      ) : null}
    </button>
  )
}
