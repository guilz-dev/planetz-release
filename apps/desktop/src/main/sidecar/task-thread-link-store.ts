import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  getThreadIdByTaskId,
  listTaskIdsByThread,
  upsertTaskThreadLink,
} from '../storage/sqlite/repositories/task-thread-link-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

/** UI-owned mapping from enqueued task to its originating conversation thread. */
export class TaskThreadLinkStore {
  async link(paths: SidecarPaths, taskId: string, threadId: string): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      upsertTaskThreadLink(db, { taskId, threadId, createdAt: new Date().toISOString() })
      return true
    } catch (error) {
      console.warn('[planetz] task thread link write failed', error)
      return false
    }
  }

  async listTaskIds(paths: SidecarPaths, threadId: string): Promise<string[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listTaskIdsByThread(db, threadId)
    } catch (error) {
      console.warn('[planetz] task thread link list failed', error)
      return []
    }
  }

  async getThreadId(paths: SidecarPaths, taskId: string): Promise<string | null> {
    try {
      const db = await getSidecarSqlite(paths)
      return getThreadIdByTaskId(db, taskId)
    } catch (error) {
      console.warn('[planetz] task thread link resolve failed', error)
      return null
    }
  }
}
