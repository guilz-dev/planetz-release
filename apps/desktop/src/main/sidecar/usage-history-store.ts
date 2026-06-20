import type { z } from 'zod'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  deleteUsageHistory,
  listUsageHistory,
  trimUsageHistory,
  type UsageHistoryKind,
  type UsageHistoryRow,
  upsertUsageHistory,
} from '../storage/sqlite/repositories/usage-history-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord, parseSidecarRecords } from './sidecar-record-parse.js'

export type UsageHistoryUpsertInput = {
  provider: string
  value: string
}

export type UsageHistoryDeleteInput = {
  provider: string
  value: string
}

export interface UsageHistoryStoreConfig<TItem> {
  kind: UsageHistoryKind
  maxItems: number
  schema: z.ZodType<TItem>
  rowToItem: (row: UsageHistoryRow) => TItem
  parseLabel: string
  missingUpsertMessage: string
  toUpsertInput(input: Record<string, string>): UsageHistoryUpsertInput
  toDeleteInput(input: Record<string, string>): UsageHistoryDeleteInput
}

export class UsageHistoryStore<TItem> {
  constructor(private readonly config: UsageHistoryStoreConfig<TItem>) {}

  async list(paths: SidecarPaths, providerFilter?: string): Promise<TItem[]> {
    const db = await getSidecarSqlite(paths)
    const filter = providerFilter?.trim()
    const rows = listUsageHistory(db, this.config.kind, filter || undefined)
    return parseSidecarRecords(rows.map(this.config.rowToItem), this.config.schema)
  }

  async upsert(paths: SidecarPaths, input: Record<string, string>): Promise<TItem> {
    const { provider, value } = this.config.toUpsertInput(input)
    if (!provider || !value) {
      throw new Error(this.config.missingUpsertMessage)
    }

    const db = await getSidecarSqlite(paths)
    const now = new Date().toISOString()
    return runSidecarTransaction(db, () => {
      const row = upsertUsageHistory(db, this.config.kind, { provider, value, lastUsedAt: now })
      trimUsageHistory(db, this.config.kind, this.config.maxItems)
      return parseSidecarRecord(
        this.config.rowToItem(row),
        this.config.schema,
        this.config.parseLabel,
      )
    })
  }

  async deleteItem(paths: SidecarPaths, input: Record<string, string>): Promise<void> {
    const { provider, value } = this.config.toDeleteInput(input)
    const db = await getSidecarSqlite(paths)
    deleteUsageHistory(db, this.config.kind, { provider, value })
  }
}
