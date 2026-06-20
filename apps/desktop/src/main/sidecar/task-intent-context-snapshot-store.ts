import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  getTaskIntentContextSnapshot,
  type TaskIntentContextSnapshot,
  upsertTaskIntentContextSnapshot,
} from '../storage/sqlite/repositories/task-intent-context-snapshot-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

export class TaskIntentContextSnapshotStore {
  async upsert(paths: SidecarPaths, snapshot: TaskIntentContextSnapshot): Promise<void> {
    const db = await getSidecarSqlite(paths)
    upsertTaskIntentContextSnapshot(db, snapshot)
  }

  async get(paths: SidecarPaths, taskId: string): Promise<TaskIntentContextSnapshot | null> {
    const db = await getSidecarSqlite(paths)
    return getTaskIntentContextSnapshot(db, taskId)
  }
}

export type { TaskIntentContextSnapshot }
