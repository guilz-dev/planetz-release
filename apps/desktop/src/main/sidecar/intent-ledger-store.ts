import type { IntentLedgerSummary } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  adoptIntentLedgerEntry,
  aggregateIntentLedgerSummary,
  countIntentLedgerEntriesForTask,
  countPendingIntentLedger,
  fixIntentLedgerEntry,
  getIntentLedgerEntryById,
  type IntentLedgerPendingQuery,
  type IntentLedgerRecord,
  type IntentLedgerSummaryQuery,
  type IntentLedgerUpsertInput,
  listIntentLedgerByIds,
  listIntentLedgerByTaskId,
  listPendingIntentLedger,
  listSupplyIntentLedger,
  ratifyIntentLedgerEntry,
  reverseIntentLedgerEntry,
  setIntentLedgerPromotedReqId,
  upsertIntentLedgerEntry,
} from '../storage/sqlite/repositories/intent-ledger-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import type { SidecarPaths } from './sidecar-paths.js'

export type { IntentLedgerRecord } from '../storage/sqlite/repositories/intent-ledger-repository.js'

function rethrowIntentLedgerReadError(operation: string, error: unknown): never {
  console.warn(`[planetz] intent ledger ${operation} failed`, error)
  if (error instanceof Error) throw error
  throw new Error(`Intent ledger ${operation} failed`)
}

export class IntentLedgerStore {
  async listByTaskId(paths: SidecarPaths, taskId: string): Promise<IntentLedgerRecord[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listIntentLedgerByTaskId(db, taskId)
    } catch (error) {
      rethrowIntentLedgerReadError('list', error)
    }
  }

  async listPending(paths: SidecarPaths, query?: IntentLedgerPendingQuery) {
    try {
      const db = await getSidecarSqlite(paths)
      return listPendingIntentLedger(db, query)
    } catch (error) {
      rethrowIntentLedgerReadError('pending list', error)
    }
  }

  async countPending(paths: SidecarPaths, query?: IntentLedgerPendingQuery): Promise<number> {
    try {
      const db = await getSidecarSqlite(paths)
      return countPendingIntentLedger(db, query)
    } catch (error) {
      rethrowIntentLedgerReadError('pending count', error)
    }
  }

  async aggregateSummary(
    paths: SidecarPaths,
    query?: IntentLedgerSummaryQuery,
  ): Promise<IntentLedgerSummary> {
    try {
      const db = await getSidecarSqlite(paths)
      return aggregateIntentLedgerSummary(db, query)
    } catch (error) {
      rethrowIntentLedgerReadError('summary', error)
    }
  }

  async listSupply(paths: SidecarPaths): Promise<IntentLedgerRecord[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listSupplyIntentLedger(db)
    } catch (error) {
      rethrowIntentLedgerReadError('supply list', error)
    }
  }

  async countEntriesForTask(paths: SidecarPaths, taskId: string): Promise<number> {
    try {
      const db = await getSidecarSqlite(paths)
      return countIntentLedgerEntriesForTask(db, taskId)
    } catch (error) {
      rethrowIntentLedgerReadError('count by task', error)
    }
  }

  async ratify(paths: SidecarPaths, entryId: string): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      return ratifyIntentLedgerEntry(db, entryId)
    } catch (error) {
      console.warn('[planetz] intent ledger ratify failed', error)
      return false
    }
  }

  async reverse(paths: SidecarPaths, entryId: string): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      return reverseIntentLedgerEntry(db, entryId)
    } catch (error) {
      console.warn('[planetz] intent ledger reverse failed', error)
      return false
    }
  }

  async adopt(
    paths: SidecarPaths,
    input: { entryId: string; reason?: string; promotedReqId?: string },
  ): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      return adoptIntentLedgerEntry(db, input)
    } catch (error) {
      console.warn('[planetz] intent ledger adopt failed', error)
      return false
    }
  }

  async fix(paths: SidecarPaths, input: { entryId: string; reason?: string }): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      return fixIntentLedgerEntry(db, input)
    } catch (error) {
      console.warn('[planetz] intent ledger fix failed', error)
      return false
    }
  }

  async setPromotedReqId(
    paths: SidecarPaths,
    entryId: string,
    promotedReqId: string,
  ): Promise<boolean> {
    try {
      const db = await getSidecarSqlite(paths)
      return setIntentLedgerPromotedReqId(db, entryId, promotedReqId)
    } catch (error) {
      console.warn('[planetz] intent ledger promoted_req_id update failed', error)
      return false
    }
  }

  async listByIds(paths: SidecarPaths, entryIds: readonly string[]): Promise<IntentLedgerRecord[]> {
    try {
      const db = await getSidecarSqlite(paths)
      return listIntentLedgerByIds(db, entryIds)
    } catch (error) {
      rethrowIntentLedgerReadError('list by ids', error)
    }
  }

  async getById(paths: SidecarPaths, entryId: string): Promise<IntentLedgerRecord | null> {
    try {
      const db = await getSidecarSqlite(paths)
      return getIntentLedgerEntryById(db, entryId)
    } catch (error) {
      rethrowIntentLedgerReadError('get by id', error)
    }
  }

  async upsertMany(paths: SidecarPaths, entries: IntentLedgerUpsertInput[]): Promise<boolean> {
    if (entries.length === 0) return true
    try {
      const db = await getSidecarSqlite(paths)
      runSidecarTransaction(db, () => {
        for (const entry of entries) {
          upsertIntentLedgerEntry(db, entry)
        }
      })
      return true
    } catch (error) {
      console.warn('[planetz] intent ledger upsert failed', error)
      return false
    }
  }
}
