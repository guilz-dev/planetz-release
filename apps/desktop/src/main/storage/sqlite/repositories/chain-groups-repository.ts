import type { DatabaseSync } from 'node:sqlite'

export type ChainGroupRow = {
  id: string
  created_at: string
  data_json: string
}

export function listChainGroupRows(db: DatabaseSync): ChainGroupRow[] {
  return db
    .prepare(
      `
        SELECT id, created_at, data_json
        FROM chain_groups
        ORDER BY created_at ASC, rowid ASC
      `,
    )
    .all() as ChainGroupRow[]
}

export function replaceAllChainGroups(
  db: DatabaseSync,
  chains: Array<{ id: string; createdAt: string; dataJson: string }>,
): void {
  db.prepare('DELETE FROM chain_groups').run()
  const insert = db.prepare(
    `
      INSERT INTO chain_groups (id, created_at, data_json)
      VALUES (?, ?, ?)
    `,
  )
  for (const chain of chains) {
    insert.run(chain.id, chain.createdAt, chain.dataJson)
  }
}
