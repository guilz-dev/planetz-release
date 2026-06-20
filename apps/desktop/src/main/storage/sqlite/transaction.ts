import type { DatabaseSync } from 'node:sqlite'

/** Run synchronous sidecar writes in a single SQLite transaction. */
export function runSidecarTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error: unknown) {
    db.exec('ROLLBACK')
    throw error
  }
}
