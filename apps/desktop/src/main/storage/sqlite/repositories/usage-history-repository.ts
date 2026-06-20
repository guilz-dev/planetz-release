import type { DatabaseSync } from 'node:sqlite'

export type UsageHistoryKind = 'model' | 'effort'

export type UsageHistoryRow = {
  provider: string
  value: string
  last_used_at: string
  use_count: number
}

const TABLE_BY_KIND = {
  model: { table: 'model_history', valueColumn: 'model' },
  effort: { table: 'effort_history', valueColumn: 'effort' },
} as const

function config(kind: UsageHistoryKind) {
  return TABLE_BY_KIND[kind]
}

export function listUsageHistory(
  db: DatabaseSync,
  kind: UsageHistoryKind,
  providerFilter?: string,
): UsageHistoryRow[] {
  const { table, valueColumn } = config(kind)
  const rows = providerFilter
    ? (db
        .prepare(
          `
            SELECT provider, ${valueColumn} AS value, last_used_at, use_count
            FROM ${table}
            WHERE provider = ?
            ORDER BY last_used_at DESC, rowid DESC
          `,
        )
        .all(providerFilter) as UsageHistoryRow[])
    : (db
        .prepare(
          `
            SELECT provider, ${valueColumn} AS value, last_used_at, use_count
            FROM ${table}
            ORDER BY last_used_at DESC, rowid DESC
          `,
        )
        .all() as UsageHistoryRow[])
  return rows
}

export function upsertUsageHistory(
  db: DatabaseSync,
  kind: UsageHistoryKind,
  input: { provider: string; value: string; lastUsedAt: string },
): UsageHistoryRow {
  const { table, valueColumn } = config(kind)
  const returning = db
    .prepare(
      `
        INSERT INTO ${table} (provider, ${valueColumn}, last_used_at, use_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(provider, ${valueColumn}) DO UPDATE SET
          last_used_at = excluded.last_used_at,
          use_count = ${table}.use_count + 1
        RETURNING provider, ${valueColumn} AS value, last_used_at, use_count
      `,
    )
    .get(input.provider, input.value, input.lastUsedAt) as UsageHistoryRow | undefined

  if (returning) return returning

  const selected = db
    .prepare(
      `
        SELECT provider, ${valueColumn} AS value, last_used_at, use_count
        FROM ${table}
        WHERE provider = ? AND ${valueColumn} = ?
      `,
    )
    .get(input.provider, input.value) as UsageHistoryRow | undefined
  if (!selected) {
    throw new Error(`Failed to upsert ${kind} usage history row`)
  }
  return selected
}

export function deleteUsageHistory(
  db: DatabaseSync,
  kind: UsageHistoryKind,
  input: { provider: string; value: string },
): void {
  const { table, valueColumn } = config(kind)
  db.prepare(`DELETE FROM ${table} WHERE provider = ? AND ${valueColumn} = ?`).run(
    input.provider,
    input.value,
  )
}

export function trimUsageHistory(db: DatabaseSync, kind: UsageHistoryKind, maxItems: number): void {
  const { table, valueColumn } = config(kind)
  db.prepare(
    `
      DELETE FROM ${table}
      WHERE (provider, ${valueColumn}) NOT IN (
        SELECT provider, ${valueColumn}
        FROM ${table}
        ORDER BY last_used_at DESC, rowid DESC
        LIMIT ?
      )
    `,
  ).run(maxItems)
}
