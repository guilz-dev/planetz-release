import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  countRequirementIntentLinksBySourceTaskId,
  listRequirementIntentLinksByThread,
  upsertRequirementIntentLink,
} from '../repositories/requirement-intent-link-repository.js'
import {
  getTaskIntentContextSnapshot,
  upsertTaskIntentContextSnapshot,
} from '../repositories/task-intent-context-snapshot-repository.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

function openDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_V1_SQL)
  runSchemaMigrations(db, 0, SQLITE_SCHEMA_VERSION)
  return db
}

describe('requirement-intent-link-repository', () => {
  it('upserts and lists links by thread', () => {
    const db = openDb()
    upsertRequirementIntentLink(db, {
      reqId: 'REQ-auth-1',
      threadId: 'thread-1',
      decidedIntentVersion: 2,
      rationale: 'Login goal',
      sourceTaskId: 'task-1',
      createdAt: '2026-06-16T00:00:00.000Z',
    })
    upsertRequirementIntentLink(db, {
      reqId: 'REQ-auth-1',
      threadId: 'thread-1',
      decidedIntentVersion: 3,
      rationale: 'Updated rationale',
      sourceTaskId: 'task-2',
      createdAt: '2026-06-16T01:00:00.000Z',
    })

    const links = listRequirementIntentLinksByThread(db, 'thread-1')
    expect(links).toHaveLength(1)
    expect(links[0]?.decidedIntentVersion).toBe(3)
    expect(links[0]?.rationale).toBe('Updated rationale')
  })

  it('counts links by source task id', () => {
    const db = openDb()
    upsertRequirementIntentLink(db, {
      reqId: 'REQ-auth-1',
      threadId: 'thread-1',
      decidedIntentVersion: 2,
      rationale: 'Login goal',
      sourceTaskId: 'task-1',
      createdAt: '2026-06-16T00:00:00.000Z',
    })
    upsertRequirementIntentLink(db, {
      reqId: 'REQ-auth-2',
      threadId: 'thread-1',
      decidedIntentVersion: 2,
      rationale: 'Logout goal',
      sourceTaskId: 'task-1',
      createdAt: '2026-06-16T00:00:00.000Z',
    })
    upsertRequirementIntentLink(db, {
      reqId: 'REQ-auth-3',
      threadId: 'thread-1',
      decidedIntentVersion: 2,
      rationale: 'Other task',
      sourceTaskId: 'task-2',
      createdAt: '2026-06-16T00:00:00.000Z',
    })

    expect(countRequirementIntentLinksBySourceTaskId(db, 'task-1')).toBe(2)
    expect(countRequirementIntentLinksBySourceTaskId(db, 'task-2')).toBe(1)
    expect(countRequirementIntentLinksBySourceTaskId(db, 'task-missing')).toBe(0)
  })
})

describe('task-intent-context-snapshot-repository', () => {
  it('upserts and reads snapshot by task id', () => {
    const db = openDb()
    upsertTaskIntentContextSnapshot(db, {
      taskId: 'task-1',
      threadId: 'thread-1',
      decidedIntentVersion: 4,
      capturedAt: '2026-06-16T00:00:00.000Z',
    })

    expect(getTaskIntentContextSnapshot(db, 'task-1')).toMatchObject({
      taskId: 'task-1',
      threadId: 'thread-1',
      decidedIntentVersion: 4,
    })
  })
})
