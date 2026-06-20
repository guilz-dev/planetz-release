import type { TaskErrorKind, TaskStatus, TaskStatusReason } from './types.js'

export interface NormalizeTaskStatusResult {
  rawStatus: string
  status: TaskStatus
  statusReason?: TaskStatusReason
  errorKind?: TaskErrorKind
}

interface KnownRawMapping {
  status: TaskStatus
  statusReason?: TaskStatusReason
  errorKind?: TaskErrorKind
}

const KNOWN_RAW_STATUS: Record<string, KnownRawMapping> = {
  pending: { status: 'pending' },
  running: { status: 'running' },
  stopped: { status: 'stopped', statusReason: 'stopped' },
  completed: { status: 'completed' },
  failed: { status: 'failed', statusReason: 'task_failed' },
  exceeded: { status: 'exceeded', statusReason: 'iteration_exceeded' },
  pr_failed: { status: 'failed', statusReason: 'pr_failed', errorKind: 'pr_creation' },
  aborted: { status: 'failed', statusReason: 'workflow_aborted' },
  interrupted: { status: 'failed', statusReason: 'interrupted' },
  cancelled: { status: 'stopped', statusReason: 'stopped' },
}

/**
 * Maps Orbit/TAKT `tasks.yaml` status strings to canonical UI `TaskStatus`.
 * Unknown values become terminal `failed` (never silent `pending`).
 */
export function normalizeTaskStatus(rawStatus: string | undefined): NormalizeTaskStatusResult {
  const raw = (rawStatus ?? 'pending').trim().toLowerCase()
  const known = KNOWN_RAW_STATUS[raw]
  if (known) {
    return {
      rawStatus: raw,
      status: known.status,
      ...(known.statusReason ? { statusReason: known.statusReason } : {}),
      ...(known.errorKind ? { errorKind: known.errorKind } : {}),
    }
  }
  return {
    rawStatus: raw,
    status: 'failed',
    statusReason: 'unknown_status',
    errorKind: 'unknown',
  }
}
