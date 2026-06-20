import type { ChainEdgeStatus, TaskStatus, TaskViewModel } from '@planetz/shared'

export function deriveEdgeStatusFromUpstream(
  origin: Pick<TaskViewModel, 'status'>,
): ChainEdgeStatus {
  if (origin.status === 'completed') return 'ready_to_create'
  if (origin.status === 'failed' || origin.status === 'exceeded') return 'blocked'
  return 'waiting_for_dependency'
}

export function syncEdgeStatusWithUpstream(
  current: ChainEdgeStatus,
  upstreamStatus: TaskStatus,
): ChainEdgeStatus {
  if (current === 'created' || current === 'invalid') return current
  if (upstreamStatus === 'completed') {
    if (current === 'waiting_for_dependency') return 'ready_to_create'
    return current
  }
  if (upstreamStatus === 'failed' || upstreamStatus === 'exceeded') return 'blocked'
  if (current === 'ready_to_create' || current === 'blocked') {
    return deriveEdgeStatusFromUpstream({ status: upstreamStatus })
  }
  return current
}
