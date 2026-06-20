import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  getTaskSupplySnapshot,
  listTaskSupplySnapshots,
  upsertTaskSupplySnapshot,
} from '../repositories/task-supply-snapshot-repository.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

function openDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_V1_SQL)
  runSchemaMigrations(db, 0, SQLITE_SCHEMA_VERSION)
  return db
}

describe('task-supply-snapshot-repository', () => {
  it('upserts and reads supply entry ids for a task', () => {
    const db = openDb()
    upsertTaskSupplySnapshot(db, {
      taskId: 'task-a',
      entryIds: ['entry-1', 'entry-2'],
      capturedAt: '2026-06-14T00:00:00.000Z',
      matchBasis: 'scope_hint_recompute',
    })

    expect(getTaskSupplySnapshot(db, 'task-a')).toEqual({
      taskId: 'task-a',
      entryIds: ['entry-1', 'entry-2'],
      capturedAt: '2026-06-14T00:00:00.000Z',
      matchBasis: 'scope_hint_recompute',
    })
  })

  it('lists snapshots for requested task ids', () => {
    const db = openDb()
    upsertTaskSupplySnapshot(db, {
      taskId: 'task-a',
      entryIds: [],
      capturedAt: '2026-06-14T00:00:00.000Z',
      matchBasis: 'scope_hint_recompute',
    })
    upsertTaskSupplySnapshot(db, {
      taskId: 'task-b',
      entryIds: ['entry-9'],
      capturedAt: '2026-06-14T01:00:00.000Z',
      matchBasis: 'scope_hint_recompute',
    })

    const rows = listTaskSupplySnapshots(db, ['task-a', 'task-b', 'task-missing'])
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.taskId === 'task-a')?.entryIds).toEqual([])
    expect(rows.find((row) => row.taskId === 'task-b')?.entryIds).toEqual(['entry-9'])
  })
})
