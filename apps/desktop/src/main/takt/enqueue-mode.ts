export type PlanetzEnqueueMode = 'package_writer' | 'takt_add'

const ENQUEUE_MODE_ENV = 'PLANETZ_ENQUEUE_MODE'
const MIGRATE_PENDING_TO_DIRECT_ENV = 'PLANETZ_MIGRATE_PENDING_TO_DIRECT'
const ALLOW_ENQUEUE_PACKAGE_FALLBACK_ENV = 'PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK'

/**
 * Runtime enqueue strategy switch.
 * Defaults to takt_add (worktree-aware enqueue path).
 * Set PLANETZ_ENQUEUE_MODE=package_writer to force direct execution writes.
 *
 * Pending-task direct-execution normalization (strip worktree on open) is unrelated:
 * set PLANETZ_MIGRATE_PENDING_TO_DIRECT=1 to enable.
 *
 * When `takt add` fails, package-writer fallback is off by default. Set
 * PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK=1 to restore legacy fallback behavior.
 */
export function resolveEnqueueMode(): PlanetzEnqueueMode {
  const raw = process.env[ENQUEUE_MODE_ENV]?.trim().toLowerCase()
  if (raw === 'package_writer') return 'package_writer'
  return 'takt_add'
}

/** When true, openWorkspace may strip worktree fields from pending/failed tasks (opt-in). */
export function isPendingDirectMigrationEnabled(): boolean {
  return process.env[MIGRATE_PENDING_TO_DIRECT_ENV]?.trim() === '1'
}

/** When true, failed `takt add` enqueue may fall back to TaskPackageWriter (no worktree). */
export function isEnqueuePackageFallbackAllowed(): boolean {
  return process.env[ALLOW_ENQUEUE_PACKAGE_FALLBACK_ENV]?.trim() === '1'
}
