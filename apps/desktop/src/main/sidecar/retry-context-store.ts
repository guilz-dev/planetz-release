import { retryContextSchema } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  insertRetryContext,
  listRetryContexts,
} from '../storage/sqlite/repositories/retry-context-repository.js'
import { parseRetryContextRecord, type RetryContextRecord } from './sidecar-entry-builders.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecords } from './sidecar-record-parse.js'

export type { RetryContextRecord } from './sidecar-entry-builders.js'

export class RetryContextStore {
  async list(paths: SidecarPaths): Promise<RetryContextRecord[]> {
    const db = await getSidecarSqlite(paths)
    return parseSidecarRecords(listRetryContexts(db), retryContextSchema)
  }

  async append(paths: SidecarPaths, record: RetryContextRecord): Promise<void> {
    const db = await getSidecarSqlite(paths)
    insertRetryContext(db, parseRetryContextRecord(record))
  }
}
