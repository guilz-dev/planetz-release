import type { DecidedIntent } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  getCurrentDecidedIntent,
  insertDecidedIntentVersion,
  listDecidedIntentVersions,
} from '../storage/sqlite/repositories/decided-intent-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

/** UI-owned Decided Intent documents (append-only versions per thread). */
export class DecidedIntentStore {
  async getCurrent(paths: SidecarPaths, threadId: string): Promise<DecidedIntent | null> {
    const db = await getSidecarSqlite(paths)
    return getCurrentDecidedIntent(db, threadId)
  }

  async listVersions(paths: SidecarPaths, threadId: string): Promise<DecidedIntent[]> {
    const db = await getSidecarSqlite(paths)
    return listDecidedIntentVersions(db, threadId)
  }

  async save(
    paths: SidecarPaths,
    input: {
      threadId: string
      what: string
      why: string
      outOfScope?: string[]
      reason?: string
    },
  ): Promise<DecidedIntent> {
    const db = await getSidecarSqlite(paths)
    return insertDecidedIntentVersion(db, { ...input, createdAt: new Date().toISOString() })
  }
}
