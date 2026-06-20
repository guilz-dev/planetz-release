import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  getCurrentDecidedIntent,
  insertDecidedIntentVersion,
  listDecidedIntentVersions,
} from '../repositories/decided-intent-repository.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

function openDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_V1_SQL)
  runSchemaMigrations(db, 0, SQLITE_SCHEMA_VERSION)
  return db
}

describe('decided-intent-repository', () => {
  it('returns null when no intent exists for a thread', () => {
    const db = openDb()
    expect(getCurrentDecidedIntent(db, 'thread-1')).toBeNull()
    expect(listDecidedIntentVersions(db, 'thread-1')).toEqual([])
  })

  it('appends versions and surfaces the latest as current', () => {
    const db = openDb()
    const v1 = insertDecidedIntentVersion(db, {
      threadId: 'thread-1',
      what: 'support retries',
      why: 'flaky network',
      outOfScope: ['UI changes'],
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    expect(v1.version).toBe(1)
    expect(v1.reason).toBeNull()
    expect(v1.outOfScope).toEqual(['UI changes'])

    const v2 = insertDecidedIntentVersion(db, {
      threadId: 'thread-1',
      what: 'support retries with backoff',
      why: 'flaky network + thundering herd',
      reason: 'clarified failure mode',
      createdAt: '2026-06-10T01:00:00.000Z',
    })
    expect(v2.version).toBe(2)

    const current = getCurrentDecidedIntent(db, 'thread-1')
    expect(current?.version).toBe(2)
    expect(current?.what).toBe('support retries with backoff')
    expect(current?.reason).toBe('clarified failure mode')
    expect(current?.outOfScope).toEqual([])

    const versions = listDecidedIntentVersions(db, 'thread-1')
    expect(versions.map((v) => v.version)).toEqual([2, 1])
  })

  it('versions are scoped per thread', () => {
    const db = openDb()
    insertDecidedIntentVersion(db, {
      threadId: 'thread-1',
      what: 'a',
      why: 'a',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    const other = insertDecidedIntentVersion(db, {
      threadId: 'thread-2',
      what: 'b',
      why: 'b',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    expect(other.version).toBe(1)
  })
})
