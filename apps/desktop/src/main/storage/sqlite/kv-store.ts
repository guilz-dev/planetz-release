import type { DatabaseSync } from 'node:sqlite'

export function readKvJson(db: DatabaseSync, key: string): unknown | null {
  const row = db.prepare('SELECT value_json FROM kv_store WHERE key = ?').get(key) as
    | { value_json?: string }
    | undefined
  if (!row?.value_json) return null
  try {
    return JSON.parse(row.value_json)
  } catch {
    return null
  }
}

export function writeKvJson(db: DatabaseSync, key: string, value: unknown): void {
  const payload = JSON.stringify(value)
  const updatedAt = new Date().toISOString()
  db.prepare(
    `
      INSERT INTO kv_store (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `,
  ).run(key, payload, updatedAt)
}
