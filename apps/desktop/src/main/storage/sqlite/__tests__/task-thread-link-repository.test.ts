import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  listTaskIdsByThread,
  upsertTaskThreadLink,
} from '../repositories/task-thread-link-repository.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

function openDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_V1_SQL)
  runSchemaMigrations(db, 0, SQLITE_SCHEMA_VERSION)
  return db
}

describe('task-thread-link-repository', () => {
  it('lists task ids for a thread oldest first', () => {
    const db = openDb()
    upsertTaskThreadLink(db, {
      taskId: 'task-a',
      threadId: 'thread-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    upsertTaskThreadLink(db, {
      taskId: 'task-b',
      threadId: 'thread-1',
      createdAt: '2026-06-10T01:00:00.000Z',
    })
    upsertTaskThreadLink(db, {
      taskId: 'task-c',
      threadId: 'thread-2',
      createdAt: '2026-06-10T02:00:00.000Z',
    })

    expect(listTaskIdsByThread(db, 'thread-1')).toEqual(['task-a', 'task-b'])
    expect(listTaskIdsByThread(db, 'thread-2')).toEqual(['task-c'])
    expect(listTaskIdsByThread(db, 'thread-missing')).toEqual([])
  })

  it('reassigns a task to a new thread on conflict', () => {
    const db = openDb()
    upsertTaskThreadLink(db, {
      taskId: 'task-a',
      threadId: 'thread-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    upsertTaskThreadLink(db, {
      taskId: 'task-a',
      threadId: 'thread-2',
      createdAt: '2026-06-10T03:00:00.000Z',
    })

    expect(listTaskIdsByThread(db, 'thread-1')).toEqual([])
    expect(listTaskIdsByThread(db, 'thread-2')).toEqual(['task-a'])
  })
})
