import type { ChainEdge, ChainEdgeStatus, ChainGroup, TaskViewModel } from '@planetz/shared'
import { chainEdgeKey, resolveChainEdgeMode } from '@planetz/shared'
import { ArrowDown, ArrowUp, GitBranch, GitMerge, Link2Off, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ExperimentalBadge } from './ui/experimental-badge'

interface ChainEdgesProps {
  task: TaskViewModel
  chains: ChainGroup[]
  tasksById: Map<string, TaskViewModel>
  onCreateChain: () => void
  onMaterialize: (input: { chainId: string; fromTaskId: string }) => void
  onSelectTask: (taskId: string) => void
  onUnlink: (chainId: string, edge: ChainEdge) => void
  materializeBusy?: boolean
  materializeWarning?: string | null
}

type EdgeBadgeTone = 'pending' | 'accent' | 'completed' | 'failed' | 'exceeded'

const STATUS_TONE: Record<ChainEdgeStatus, EdgeBadgeTone> = {
  waiting_for_dependency: 'pending',
  ready_to_create: 'accent',
  created: 'completed',
  blocked: 'failed',
  invalid: 'exceeded',
}

const STATUS_LABEL: Record<ChainEdgeStatus, string> = {
  waiting_for_dependency: 'waiting',
  ready_to_create: 'ready',
  created: 'created',
  blocked: 'blocked',
  invalid: 'invalid',
}

interface EdgeRowProps {
  edge: ChainEdge
  direction: 'incoming' | 'outgoing'
  peer?: TaskViewModel
  chainId: string
  onSelect: (taskId: string) => void
  onUnlink: (chainId: string, edge: ChainEdge) => void
  onMaterialize?: () => void
  materializeBusy?: boolean
  materializeWarning?: string | null
}

function EdgeRow({
  edge,
  direction,
  peer,
  chainId,
  onSelect,
  onUnlink,
  onMaterialize,
  materializeBusy,
  materializeWarning,
}: EdgeRowProps) {
  const isPending = !edge.toTaskId
  const edgeMode = resolveChainEdgeMode(edge)
  const sourceBranch = edge.sourceBranch ?? edge.planned?.sourceBranch
  const [branchMissing, setBranchMissing] = useState(false)

  useEffect(() => {
    if (!sourceBranch || edge.status !== 'ready_to_create' || !isPending) {
      setBranchMissing(false)
      return
    }
    let cancelled = false
    void window.orbit.checkChainSourceBranch(sourceBranch).then(({ exists }) => {
      if (!cancelled) setBranchMissing(!exists)
    })
    return () => {
      cancelled = true
    }
  }, [sourceBranch, edge.status, isPending])
  const peerId = direction === 'incoming' ? edge.fromTaskId : edge.toTaskId
  const peerLabel =
    peer?.title ??
    (isPending && direction === 'outgoing' && edge.planned
      ? `${edge.planned.title} (reserved)`
      : peerId)

  return (
    <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 px-2.5 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--color-panel-strong)] text-[var(--color-muted-strong)]"
            aria-hidden="true"
          >
            {direction === 'incoming' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          </span>
          {peerId ? (
            <button
              type="button"
              className="min-w-0 truncate font-mono text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => peerId && onSelect(peerId)}
              disabled={!peerId}
            >
              {peerLabel}
            </button>
          ) : (
            <span className="min-w-0 truncate text-xs text-[var(--color-text)]">{peerLabel}</span>
          )}
          <Badge tone={STATUS_TONE[edge.status]}>{STATUS_LABEL[edge.status]}</Badge>
        </div>
        <button
          type="button"
          aria-label="Unlink"
          className="text-[var(--color-muted)] hover:text-[var(--color-status-failed)]"
          onClick={() => onUnlink(chainId, edge)}
        >
          <Link2Off size={11} />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1">
          {edgeMode === 'branch_handoff' ? <GitBranch size={10} /> : <GitMerge size={10} />}
          <span className="font-mono">{edgeMode}</span>
        </span>
        {edge.sourceBranch ? <span className="font-mono">src: {edge.sourceBranch}</span> : null}
        {edge.baseBranch ? <span className="font-mono">base: {edge.baseBranch}</span> : null}
      </div>
      {branchMissing && sourceBranch ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-status-failed)]">
          Source branch &quot;{sourceBranch}&quot; was not found locally (refs/heads or origin).
        </p>
      ) : null}
      {materializeWarning ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-status-failed)]">{materializeWarning}</p>
      ) : null}
      {edge.status === 'ready_to_create' &&
      isPending &&
      direction === 'outgoing' &&
      onMaterialize ? (
        <div className="mt-2">
          <Button
            size="sm"
            variant="primary"
            disabled={materializeBusy}
            onClick={() => onMaterialize()}
          >
            {materializeBusy ? 'Creating task…' : 'Create task now'}
          </Button>
        </div>
      ) : null}
    </li>
  )
}

export function ChainEdges({
  task,
  chains,
  tasksById,
  onCreateChain,
  onMaterialize,
  onSelectTask,
  onUnlink,
  materializeBusy,
  materializeWarning,
}: ChainEdgesProps) {
  type Located = { chainId: string; edge: ChainEdge; direction: 'incoming' | 'outgoing' }
  const located: Located[] = []
  for (const group of chains) {
    for (const edge of group.edges) {
      if (edge.fromTaskId === task.id) {
        located.push({ chainId: group.id, edge, direction: 'outgoing' })
      } else if (edge.toTaskId === task.id) {
        located.push({ chainId: group.id, edge, direction: 'incoming' })
      }
    }
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
          Chain
          <ExperimentalBadge />
        </p>
        <Button size="sm" variant="subtle" leading={<Plus size={11} />} onClick={onCreateChain}>
          Reserve dependent task
        </Button>
      </div>
      {located.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">
          No chain edges yet. Reserve a dependent task to continue after this one completes.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {located.map((loc) => (
            <EdgeRow
              key={`${loc.chainId}:${chainEdgeKey(loc.edge)}`}
              edge={loc.edge}
              direction={loc.direction}
              peer={
                loc.direction === 'incoming'
                  ? tasksById.get(loc.edge.fromTaskId)
                  : loc.edge.toTaskId
                    ? tasksById.get(loc.edge.toTaskId)
                    : undefined
              }
              chainId={loc.chainId}
              onSelect={onSelectTask}
              onUnlink={onUnlink}
              materializeBusy={materializeBusy}
              materializeWarning={materializeWarning}
              onMaterialize={
                loc.direction === 'outgoing' &&
                loc.edge.status === 'ready_to_create' &&
                !loc.edge.toTaskId
                  ? () =>
                      onMaterialize({
                        chainId: loc.chainId,
                        fromTaskId: loc.edge.fromTaskId,
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
