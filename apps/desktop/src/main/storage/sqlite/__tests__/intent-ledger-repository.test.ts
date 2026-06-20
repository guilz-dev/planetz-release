import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  adoptIntentLedgerEntry,
  aggregateIntentLedgerSummary,
  countPendingIntentLedger,
  fixIntentLedgerEntry,
  listIntentLedgerByIds,
  listIntentLedgerByTaskId,
  listPendingIntentLedger,
  listSupplyIntentLedger,
  ratifyIntentLedgerEntry,
  reverseIntentLedgerEntry,
  setIntentLedgerPromotedReqId,
  upsertIntentLedgerEntry,
} from '../repositories/intent-ledger-repository.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL } from '../schema-v1.js'

describe('intent-ledger-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  async function openDb(): Promise<DatabaseSync> {
    const root = await mkdtemp(join(tmpdir(), 'intent-ledger-repo-'))
    roots.push(root)
    await mkdir(root, { recursive: true })
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(db, 0, 15)
    return db
  }

  it('upserts entries idempotently on (task_id, source_run, decision_id)', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-abc',
      decisionId: 'd1',
      statement: 'Use SQLite for ledger',
      authority: 'designed',
      scopeHint: 'storage',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-abc',
      decisionId: 'd1',
      statement: 'Use SQLite for ledger (updated)',
      authority: 'required',
      createdAt: '2026-06-10T01:00:00.000Z',
    })

    const rows = listIntentLedgerByTaskId(db, 'task-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.statement).toBe('Use SQLite for ledger (updated)')
    expect(rows[0]?.authority).toBe('required')
  })

  it('lists pending assumed entries and supports ratify/reverse', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'cheap-assumed',
      statement: 'Cheap assumption',
      authority: 'assumed',
      reversibility: 'cheap',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'expensive-assumed',
      statement: 'Expensive assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'required',
      statement: 'Required decision',
      authority: 'required',
      createdAt,
    })

    expect(listPendingIntentLedger(db)).toHaveLength(2)
    expect(countPendingIntentLedger(db)).toBe(2)
    expect(listPendingIntentLedger(db, { expensiveOnly: true })).toHaveLength(1)

    const pendingId = listPendingIntentLedger(db)[0]?.id
    expect(pendingId).toBeTruthy()
    expect(ratifyIntentLedgerEntry(db, pendingId!)).toBe(true)
    expect(listPendingIntentLedger(db)).toHaveLength(1)

    const remainingId = listPendingIntentLedger(db)[0]?.id
    expect(reverseIntentLedgerEntry(db, remainingId!)).toBe(true)
    expect(listPendingIntentLedger(db)).toHaveLength(0)
    expect(listSupplyIntentLedger(db)).toHaveLength(2)
  })

  it('does not overwrite ratified authority on re-ingest upsert', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Original assumption',
      authority: 'assumed',
      createdAt,
    })
    expect(ratifyIntentLedgerEntry(db, 'task-1:run-a:d1')).toBe(true)

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Re-ingested assumption',
      authority: 'assumed',
      createdAt: '2026-06-10T01:00:00.000Z',
    })

    const rows = listIntentLedgerByTaskId(db, 'task-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.authority).toBe('ratified')
    expect(rows[0]?.statement).toBe('Re-ingested assumption')
    expect(rows[0]?.ratifiedAt).not.toBeNull()
  })

  it('flags scope conflicts on pending assumed entries', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'ratified-scope',
      statement: 'Use Postgres',
      authority: 'assumed',
      scopeHint: 'storage',
      createdAt,
    })
    expect(ratifyIntentLedgerEntry(db, 'task-1:run-a:ratified-scope')).toBe(true)

    upsertIntentLedgerEntry(db, {
      taskId: 'task-2',
      sourceRun: 'run-b',
      decisionId: 'new-assumed',
      statement: 'Maybe SQLite again',
      authority: 'assumed',
      scopeHint: 'storage',
      reversibility: 'expensive',
      createdAt: '2026-06-10T01:00:00.000Z',
    })

    const pending = listPendingIntentLedger(db)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.scopeConflict).toBe(true)
  })

  it('aggregates intent ledger summary for analytics windows', async () => {
    const db = await openDb()
    const nowMs = Date.parse('2026-06-10T12:00:00.000Z')

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'assumed-old',
      statement: 'Old assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-b',
      decisionId: 'assumed-new',
      statement: 'New assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    ratifyIntentLedgerEntry(db, 'task-1:run-b:assumed-new')

    const summary = aggregateIntentLedgerSummary(db, { window: '7d' }, nowMs)
    expect(summary.ingestedAssumedCount).toBe(1)
    expect(summary.ratifiedCount).toBe(1)
    expect(summary.reversedCount).toBe(0)
    expect(summary.adjudicationRate).toBe(1)
    expect(summary.pendingCount).toBe(1)
  })

  it('does not let adjudication rate exceed 1 when old assumptions are ratified in-window', async () => {
    const db = await openDb()
    const nowMs = Date.parse('2026-06-10T12:00:00.000Z')

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-old',
      decisionId: 'old-assumed',
      statement: 'Ingested outside window',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt: '2026-05-20T00:00:00.000Z',
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-new',
      decisionId: 'new-assumed',
      statement: 'Ingested inside window',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    ratifyIntentLedgerEntry(db, 'task-1:run-old:old-assumed')
    ratifyIntentLedgerEntry(db, 'task-1:run-new:new-assumed')

    const summary = aggregateIntentLedgerSummary(db, { window: '7d' }, nowMs)
    expect(summary.ingestedAssumedCount).toBe(1)
    expect(summary.ratifiedCount).toBe(1)
    expect(summary.adjudicationRate).toBe(1)
  })

  it('applies expensiveOnly to summary pendingCount', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'cheap',
      statement: 'Cheap assumption',
      authority: 'assumed',
      reversibility: 'cheap',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'expensive',
      statement: 'Expensive assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })

    expect(aggregateIntentLedgerSummary(db, { expensiveOnly: true }).pendingCount).toBe(1)
    expect(aggregateIntentLedgerSummary(db, { expensiveOnly: false }).pendingCount).toBe(2)
  })

  it('filters pending list by task id', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Task one',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-2',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Task two',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })

    expect(listPendingIntentLedger(db, { taskId: 'task-1' })).toHaveLength(1)
    expect(countPendingIntentLedger(db, { taskId: 'task-2' })).toBe(1)
  })

  it('flags unanchored pending entries and counts them in summary', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'anchored',
      statement: 'Anchored assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      satisfies: ['REQ-auth-1'],
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'unanchored',
      statement: 'Floating assumption',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })

    const pending = listPendingIntentLedger(db)
    expect(pending).toHaveLength(2)
    const unanchored = pending.find((entry) => entry.decisionId === 'unanchored')
    const anchored = pending.find((entry) => entry.decisionId === 'anchored')
    expect(unanchored?.unanchored).toBe(true)
    expect(anchored?.unanchored).toBe(false)
    expect(anchored?.satisfies).toEqual(['REQ-auth-1'])

    const summary = aggregateIntentLedgerSummary(db)
    expect(summary.unanchoredCount).toBe(1)
  })

  it('preserves trace columns when re-ingesting an adjudicated entry', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'
    const id = 'task-1:run-a:traced'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'traced',
      statement: 'Ratified with trace',
      authority: 'assumed',
      satisfies: ['REQ-auth-1'],
      deviates: ['DSN-api-1'],
      createdAt,
    })
    expect(ratifyIntentLedgerEntry(db, id)).toBe(true)

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'traced',
      statement: 'Ratified with trace (re-ingest)',
      authority: 'assumed',
      createdAt,
    })

    const rows = listIntentLedgerByTaskId(db, 'task-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.authority).toBe('ratified')
    expect(rows[0]?.satisfies).toEqual(['REQ-auth-1'])
    expect(rows[0]?.deviates).toEqual(['DSN-api-1'])
  })

  it('lists observed entries in pending queue and always shows them with expensiveOnly filter', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'obs-1',
      statement: 'Drift in auth handler',
      authority: 'observed',
      sourceDoc: 'src/auth.ts:42',
      satisfies: ['REQ-auth-1'],
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'cheap-assumed',
      statement: 'Cheap assumption',
      authority: 'assumed',
      reversibility: 'cheap',
      createdAt,
    })

    expect(listPendingIntentLedger(db, { expensiveOnly: true })).toHaveLength(1)
    expect(listPendingIntentLedger(db, { expensiveOnly: true })[0]?.authority).toBe('observed')
    expect(listSupplyIntentLedger(db).every((row) => row.authority !== 'observed')).toBe(true)
  })

  it('computes theater metrics in summary', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'
    const ratifiedAt = '2026-06-10T01:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'anchored',
      statement: 'Anchored',
      authority: 'assumed',
      satisfies: ['REQ-auth-1'],
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'unanchored',
      statement: 'Floating',
      authority: 'assumed',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-2',
      sourceRun: 'run-b',
      decisionId: 'ratified-one',
      statement: 'Approved assumption',
      authority: 'assumed',
      satisfies: ['REQ-auth-2'],
      createdAt,
    })
    ratifyIntentLedgerEntry(db, 'task-2:run-b:ratified-one')
    db.prepare(
      `UPDATE intent_ledger SET ratified_at = ? WHERE id = 'task-2:run-b:ratified-one'`,
    ).run(ratifiedAt)

    upsertIntentLedgerEntry(db, {
      taskId: 'task-3',
      sourceRun: 'run-c',
      decisionId: 'reversed-one',
      statement: 'Rejected assumption',
      authority: 'assumed',
      createdAt,
    })
    reverseIntentLedgerEntry(db, 'task-3:run-c:reversed-one')
    db.prepare(
      `UPDATE intent_ledger SET ratified_at = ? WHERE id = 'task-3:run-c:reversed-one'`,
    ).run(ratifiedAt)

    const summary = aggregateIntentLedgerSummary(db, { window: 'all' })
    expect(summary.unanchoredRate).toBeCloseTo(0.5)
    expect(summary.ratifyRatio).toBeCloseTo(0.5)
    expect(summary.reverseRatio).toBeCloseTo(0.5)
    expect(summary.adjudicationLatencyP50Ms).toBe(3_600_000)
  })

  it('persists observed unanchored flag separately from evidence sourceDoc', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'obs-drift',
      statement: 'Spec drift in auth',
      authority: 'observed',
      sourceDoc: 'src/auth.ts:42',
      observedUnanchored: true,
      createdAt,
    })

    const pending = listPendingIntentLedger(db)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.unanchored).toBe(true)
  })

  it('applies expensiveOnly filter to unanchoredRate cohort', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'cheap-unanchored',
      statement: 'Cheap floating',
      authority: 'assumed',
      reversibility: 'cheap',
      createdAt,
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'expensive-unanchored',
      statement: 'Expensive floating',
      authority: 'assumed',
      reversibility: 'expensive',
      createdAt,
    })

    const allSummary = aggregateIntentLedgerSummary(db, { window: 'all' })
    expect(allSummary.unanchoredRate).toBeCloseTo(1)

    const expensiveSummary = aggregateIntentLedgerSummary(db, {
      window: 'all',
      expensiveOnly: true,
    })
    expect(expensiveSummary.unanchoredRate).toBeCloseTo(1)
    expect(expensiveSummary.unanchoredCount).toBe(1)
  })

  it('supports adopt/fix adjudication on observed entries and summary counts', async () => {
    const db = await openDb()
    const createdAt = '2026-06-10T00:00:00.000Z'
    const ratifiedAt = '2026-06-10T12:00:00.000Z'

    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'obs-1',
      statement: 'Observed drift',
      authority: 'observed',
      sourceDoc: 'src/a.ts:1',
      observedUnanchored: true,
      createdAt,
    })
    expect(
      adoptIntentLedgerEntry(db, {
        entryId: 'task-1:run-a:obs-1',
        reason: 'operator adopt',
      }),
    ).toBe(true)
    expect(setIntentLedgerPromotedReqId(db, 'task-1:run-a:obs-1', 'REQ-auth-9')).toBe(true)

    upsertIntentLedgerEntry(db, {
      taskId: 'task-2',
      sourceRun: 'run-b',
      decisionId: 'obs-2',
      statement: 'Another drift',
      authority: 'observed',
      sourceDoc: 'src/b.ts:2',
      observedUnanchored: true,
      createdAt,
    })
    expect(
      fixIntentLedgerEntry(db, { entryId: 'task-2:run-b:obs-2', reason: 'operator fix' }),
    ).toBe(true)

    db.prepare(`UPDATE intent_ledger SET ratified_at = ? WHERE id LIKE 'task-%'`).run(ratifiedAt)

    const supply = listSupplyIntentLedger(db)
    expect(
      supply.some((row) => row.id === 'task-1:run-a:obs-1' && row.authority === 'ratified'),
    ).toBe(true)
    expect(
      supply.some((row) => row.id === 'task-2:run-b:obs-2' && row.authority === 'reversed'),
    ).toBe(false)

    const summary = aggregateIntentLedgerSummary(db, { window: 'all' })
    expect(summary.adoptCount).toBe(1)
    expect(summary.fixCount).toBe(1)
  })

  it('listIntentLedgerByIds returns ledger rows for the requested ids', async () => {
    const db = await openDb()
    upsertIntentLedgerEntry(db, {
      taskId: 'task-a',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Workspace supply entry',
      authority: 'ratified',
      createdAt: '2026-06-10T00:00:00.000Z',
    })
    upsertIntentLedgerEntry(db, {
      taskId: 'task-b',
      sourceRun: 'run-b',
      decisionId: 'd2',
      statement: 'Other entry',
      authority: 'required',
      createdAt: '2026-06-11T00:00:00.000Z',
    })

    const rows = listIntentLedgerByIds(db, ['task-a:run-a:d1', 'missing-id'])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('task-a:run-a:d1')
  })
})
