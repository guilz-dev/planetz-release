import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  getTaskSupplySnapshot,
  listTaskSupplySnapshots,
  type TaskSupplySnapshotRecord,
  upsertTaskSupplySnapshot,
} from '../storage/sqlite/repositories/task-supply-snapshot-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

const DEFAULT_MATCH_BASIS = 'scope_hint_recompute'

/** UI-owned record of which ledger entries were supplied at task run dispatch. */
export class TaskSupplySnapshotStore {
  async upsert(
    paths: SidecarPaths,
    taskId: string,
    entryIds: readonly string[],
    capturedAt: string = new Date().toISOString(),
  ): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      upsertTaskSupplySnapshot(db, {
        taskId,
        entryIds,
        capturedAt,
        matchBasis: DEFAULT_MATCH_BASIS,
      })
      return true
    } catch (error) {
      console.warn('[planetz] task supply snapshot write failed', error)
      return false
    }
  }

  async get(paths: SidecarPaths, taskId: string): Promise<TaskSupplySnapshotRecord | null> {
    try {
      const db = await getSidecarSqlite(paths)
      return getTaskSupplySnapshot(db, taskId)
    } catch (error) {
      console.warn('[planetz] task supply snapshot read failed', error)
      return null
    }
  }

  async listByTaskIds(
    paths: SidecarPaths,
    taskIds: readonly string[],
  ): Promise<TaskSupplySnapshotRecord[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listTaskSupplySnapshots(db, taskIds)
    } catch (error) {
      console.warn('[planetz] task supply snapshot list failed', error)
      return []
    }
  }
}
