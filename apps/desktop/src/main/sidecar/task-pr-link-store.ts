import type { TaskPrSummary } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  listTaskPrLinks,
  type TaskPrLinkRecord,
  upsertTaskPrLink,
} from '../storage/sqlite/repositories/task-pr-link-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import type { SidecarPaths } from './sidecar-paths.js'

export type { TaskPrLinkRecord } from '../storage/sqlite/repositories/task-pr-link-repository.js'

export class TaskPrLinkStore {
  async list(paths: SidecarPaths): Promise<TaskPrLinkRecord[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listTaskPrLinks(db)
    } catch (error) {
      console.warn('[planetz] task pr link list failed', error)
      return []
    }
  }

  async upsert(
    paths: SidecarPaths,
    input: {
      taskId: string
      branch: string
      repo: string
      pr: TaskPrSummary
    },
  ): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      runSidecarTransaction(db, () => {
        upsertTaskPrLink(db, {
          ...input,
          updatedAt: new Date().toISOString(),
        })
      })
      return true
    } catch (error) {
      console.warn('[planetz] task pr link upsert failed', error)
      return false
    }
  }
}
