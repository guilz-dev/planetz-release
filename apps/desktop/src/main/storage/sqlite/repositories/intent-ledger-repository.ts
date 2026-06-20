import type { DatabaseSync } from 'node:sqlite'
import {
  type AdjudicationKind,
  type DecisionReportReversibility,
  type ExecutionAnalyticsWindow,
  type IntentLedgerAuthority,
  type IntentLedgerEntry,
  type IntentLedgerSummary,
  isLedgerEntryUnanchored,
} from '@planetz/shared'
import { resolveAnalyticsSinceIso } from '../../../planetz/analytics-window.js'

export interface IntentLedgerRow {
  id: string
  task_id: string
  source_run: string
  decision_id: string
  statement: string
  authority: IntentLedgerAuthority
  scope_hint: string | null
  source_doc: string | null
  source_run_doc: string | null
  created_at: string
  ratified_at: string | null
  reversibility: DecisionReportReversibility | null
  satisfies_json: string | null
  deviates_json: string | null
  observed_unanchored: number | null
  adjudication_kind: AdjudicationKind | null
  adjudication_reason: string | null
  promoted_req_id: string | null
}

export interface IntentLedgerRecord {
  id: string
  taskId: string
  sourceRun: string
  decisionId: string
  statement: string
  authority: IntentLedgerAuthority
  scopeHint: string | null
  sourceDoc: string | null
  sourceRunDoc: string | null
  createdAt: string
  ratifiedAt: string | null
  reversibility: DecisionReportReversibility | null
  satisfies: string[] | null
  deviates: string[] | null
  observedUnanchored?: boolean | null
  adjudicationKind?: AdjudicationKind | null
  adjudicationReason?: string | null
  promotedReqId?: string | null
}

export interface IntentLedgerUpsertInput {
  taskId: string
  sourceRun: string
  decisionId: string
  statement: string
  authority: IntentLedgerAuthority
  scopeHint?: string
  sourceDoc?: string
  sourceRunDoc?: string
  reversibility?: DecisionReportReversibility
  satisfies?: string[]
  deviates?: string[]
  observedUnanchored?: boolean
  createdAt: string
}

export interface IntentLedgerPendingQuery {
  expensiveOnly?: boolean
  taskId?: string
}

export interface IntentLedgerSummaryQuery {
  window?: ExecutionAnalyticsWindow
  expensiveOnly?: boolean
}

export interface IntentLedgerAdjudicateInput {
  entryId: string
  reason?: string
  promotedReqId?: string
}

const SCOPE_CONFLICT_EXISTS_SQL = `
  scope_hint IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM intent_ledger ratified_row
    WHERE ratified_row.authority = 'ratified'
      AND ratified_row.scope_hint IS NOT NULL
      AND lower(trim(ratified_row.scope_hint)) = lower(trim(intent_ledger.scope_hint))
  )
`

const PENDING_QUEUE_AUTHORITY_SQL = `authority IN ('assumed', 'observed')`

function medianMs(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const lower = sorted[mid - 1]
  const upper = sorted[mid]
  if (lower === undefined || upper === undefined) return null
  return Math.floor((lower + upper) / 2)
}

function adjudicationLatencyP50Ms(db: DatabaseSync, sinceIso: string | null): number | null {
  const rows = (
    sinceIso
      ? db
          .prepare(
            `
              SELECT created_at, ratified_at FROM intent_ledger
              WHERE authority IN ('ratified', 'reversed')
                AND ratified_at IS NOT NULL
                AND created_at >= ?
            `,
          )
          .all(sinceIso)
      : db
          .prepare(
            `
              SELECT created_at, ratified_at FROM intent_ledger
              WHERE authority IN ('ratified', 'reversed')
                AND ratified_at IS NOT NULL
            `,
          )
          .all()
  ) as Array<{ created_at: string; ratified_at: string | null }>

  const latencies = rows
    .map((row) => {
      const start = Date.parse(row.created_at)
      const end = row.ratified_at ? Date.parse(row.ratified_at) : Number.NaN
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
      return end - start
    })
    .filter((value): value is number => value !== null)

  return medianMs(latencies)
}

function countUnanchoredInAssumedCohort(
  db: DatabaseSync,
  sinceIso: string | null,
  expensiveOnly?: boolean,
): number {
  const expensiveSql = expensiveOnly ? ` AND reversibility = 'expensive'` : ''
  const rows = (
    sinceIso
      ? db
          .prepare(
            `
              SELECT authority, satisfies_json, deviates_json, source_doc, observed_unanchored
              FROM intent_ledger
              WHERE (${ASSUMED_INGEST_COHORT_SQL})
                AND created_at >= ?
                ${expensiveSql}
            `,
          )
          .all(sinceIso)
      : db
          .prepare(
            `
              SELECT authority, satisfies_json, deviates_json, source_doc, observed_unanchored
              FROM intent_ledger
              WHERE (${ASSUMED_INGEST_COHORT_SQL})
                ${expensiveSql}
            `,
          )
          .all()
  ) as Array<{
    authority: IntentLedgerAuthority
    satisfies_json: string | null
    deviates_json: string | null
    source_doc: string | null
    observed_unanchored: number | null
  }>

  return rows.filter((row) =>
    isLedgerEntryUnanchored({
      authority: row.authority,
      satisfies: parseJsonStringArray(row.satisfies_json),
      deviates: parseJsonStringArray(row.deviates_json),
      sourceDoc: row.source_doc,
      observedUnanchored: row.observed_unanchored === null ? null : row.observed_unanchored === 1,
    }),
  ).length
}

function intentLedgerId(taskId: string, sourceRun: string, decisionId: string): string {
  return `${taskId}:${sourceRun}:${decisionId}`
}

function parseJsonStringArray(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const strings = parsed.filter((item): item is string => typeof item === 'string')
    return strings.length > 0 ? strings : null
  } catch {
    return null
  }
}

function serializeJsonStringArray(values?: string[]): string | null {
  if (!values?.length) return null
  return JSON.stringify(values)
}

function parseObservedUnanchored(raw: number | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null
  return raw === 1
}

function serializeObservedUnanchored(value?: boolean): number | null {
  if (value === undefined) return null
  return value ? 1 : 0
}

function rowToRecord(row: IntentLedgerRow): IntentLedgerRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    sourceRun: row.source_run,
    decisionId: row.decision_id,
    statement: row.statement,
    authority: row.authority,
    scopeHint: row.scope_hint,
    sourceDoc: row.source_doc,
    sourceRunDoc: row.source_run_doc,
    createdAt: row.created_at,
    ratifiedAt: row.ratified_at,
    reversibility: row.reversibility,
    satisfies: parseJsonStringArray(row.satisfies_json),
    deviates: parseJsonStringArray(row.deviates_json),
    observedUnanchored: parseObservedUnanchored(row.observed_unanchored),
    adjudicationKind: row.adjudication_kind,
    adjudicationReason: row.adjudication_reason,
    promotedReqId: row.promoted_req_id,
  }
}

/** Maps a repository row to the shared IPC/UI entry shape. */
export function intentLedgerRecordToEntry(
  record: IntentLedgerRecord,
  scopeConflict?: boolean,
): IntentLedgerEntry {
  return recordToEntry(record, scopeConflict)
}

function recordToEntry(record: IntentLedgerRecord, scopeConflict?: boolean): IntentLedgerEntry {
  return {
    id: record.id,
    taskId: record.taskId,
    sourceRun: record.sourceRun,
    decisionId: record.decisionId,
    statement: record.statement,
    authority: record.authority,
    scopeHint: record.scopeHint,
    sourceDoc: record.sourceDoc,
    sourceRunDoc: record.sourceRunDoc,
    createdAt: record.createdAt,
    ratifiedAt: record.ratifiedAt,
    reversibility: record.reversibility,
    satisfies: record.satisfies,
    deviates: record.deviates,
    unanchored: isLedgerEntryUnanchored({
      authority: record.authority,
      satisfies: record.satisfies,
      deviates: record.deviates,
      sourceDoc: record.sourceDoc,
      observedUnanchored: record.observedUnanchored,
    }),
    scopeConflict,
    adjudicationKind: record.adjudicationKind ?? null,
    adjudicationReason: record.adjudicationReason ?? null,
    promotedReqId: record.promotedReqId ?? null,
  }
}

const INTENT_LEDGER_SELECT_COLUMNS = `
  id, task_id, source_run, decision_id, statement, authority,
  scope_hint, source_doc, source_run_doc, created_at, ratified_at, reversibility,
  satisfies_json, deviates_json, observed_unanchored,
  adjudication_kind, adjudication_reason, promoted_req_id
`

function pendingWhereClause(query?: IntentLedgerPendingQuery): string {
  const parts = [PENDING_QUEUE_AUTHORITY_SQL, `ratified_at IS NULL`]
  if (query?.expensiveOnly) {
    parts.push(`(authority = 'observed' OR reversibility = 'expensive')`)
  }
  if (query?.taskId) {
    parts.push(`task_id = ?`)
  }
  return parts.join(' AND ')
}

function pendingWhereArgs(query?: IntentLedgerPendingQuery): string[] {
  return query?.taskId ? [query.taskId] : []
}

type IntentLedgerPendingRow = IntentLedgerRow & { scope_conflict: number }

export function listIntentLedgerByTaskId(db: DatabaseSync, taskId: string): IntentLedgerRecord[] {
  const rows = db
    .prepare(
      `
        SELECT ${INTENT_LEDGER_SELECT_COLUMNS}
        FROM intent_ledger
        WHERE task_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(taskId) as unknown as IntentLedgerRow[]
  return rows.map(rowToRecord)
}

function pendingRowToEntry(row: IntentLedgerPendingRow): IntentLedgerEntry {
  return recordToEntry(rowToRecord(row), row.scope_conflict === 1)
}

export function listPendingIntentLedger(
  db: DatabaseSync,
  query?: IntentLedgerPendingQuery,
): IntentLedgerEntry[] {
  const rows = db
    .prepare(
      `
        SELECT ${INTENT_LEDGER_SELECT_COLUMNS},
          CASE WHEN ${SCOPE_CONFLICT_EXISTS_SQL} THEN 1 ELSE 0 END AS scope_conflict
        FROM intent_ledger
        WHERE ${pendingWhereClause(query)}
        ORDER BY created_at ASC
      `,
    )
    .all(...pendingWhereArgs(query)) as unknown as IntentLedgerPendingRow[]
  return rows.map(pendingRowToEntry)
}

export function countPendingIntentLedger(
  db: DatabaseSync,
  query?: IntentLedgerPendingQuery,
): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM intent_ledger
        WHERE ${pendingWhereClause(query)}
      `,
    )
    .get(...pendingWhereArgs(query)) as { count: number }
  return row.count
}

/** Assumptions ingested in the window (still pending or already adjudicated). */
const ASSUMED_INGEST_COHORT_SQL = `authority = 'assumed' OR authority IN ('ratified', 'reversed')`

function countSinceCreatedAt(
  db: DatabaseSync,
  sinceIso: string | null,
  filterSql: string,
  filterArgs: IntentLedgerAuthority[] = [],
): number {
  const row = (
    sinceIso
      ? db
          .prepare(
            `
              SELECT COUNT(*) AS count FROM intent_ledger
              WHERE created_at >= ?
                AND (${filterSql})
            `,
          )
          .get(sinceIso, ...filterArgs)
      : db
          .prepare(
            `
              SELECT COUNT(*) AS count FROM intent_ledger
              WHERE ${filterSql}
            `,
          )
          .get(...filterArgs)
  ) as { count: number }
  return row.count
}

function countAssumedIngestCohort(
  db: DatabaseSync,
  sinceIso: string | null,
  authority?: IntentLedgerAuthority,
  expensiveOnly?: boolean,
): number {
  const expensiveSql = expensiveOnly ? " AND reversibility = 'expensive'" : ''
  if (authority) {
    return countSinceCreatedAt(db, sinceIso, `authority = ?${expensiveSql}`, [authority])
  }
  return countSinceCreatedAt(db, sinceIso, `(${ASSUMED_INGEST_COHORT_SQL})${expensiveSql}`)
}

/** Counts adopt/fix by adjudication time (`ratified_at`), not ingest time (`created_at`). */
function countAdjudicationKindInWindow(
  db: DatabaseSync,
  sinceIso: string | null,
  kind: AdjudicationKind,
): number {
  const row = (
    sinceIso
      ? db
          .prepare(
            `
              SELECT COUNT(*) AS count FROM intent_ledger
              WHERE adjudication_kind = ?
                AND ratified_at IS NOT NULL
                AND ratified_at >= ?
            `,
          )
          .get(kind, sinceIso)
      : db
          .prepare(
            `
              SELECT COUNT(*) AS count FROM intent_ledger
              WHERE adjudication_kind = ?
                AND ratified_at IS NOT NULL
            `,
          )
          .get(kind)
  ) as { count: number }
  return row.count
}

export function aggregateIntentLedgerSummary(
  db: DatabaseSync,
  query?: IntentLedgerSummaryQuery,
  nowMs = Date.now(),
): IntentLedgerSummary {
  const window: ExecutionAnalyticsWindow = query?.window ?? '7d'
  const sinceIso = resolveAnalyticsSinceIso(window, nowMs)

  const ingestedAssumedCount = countAssumedIngestCohort(db, sinceIso)

  const pendingEntries = listPendingIntentLedger(db, {
    expensiveOnly: query?.expensiveOnly,
  })
  const pendingCount = pendingEntries.length
  const unanchoredCount = pendingEntries.filter((entry) => entry.unanchored).length

  const ratifiedCount = countAssumedIngestCohort(db, sinceIso, 'ratified')
  const reversedCount = countAssumedIngestCohort(db, sinceIso, 'reversed')

  const scopeConflictCount = countSinceCreatedAt(
    db,
    sinceIso,
    `authority = 'assumed' AND ${SCOPE_CONFLICT_EXISTS_SQL}`,
  )

  const adjudicated = ratifiedCount + reversedCount
  const adjudicationRate = ingestedAssumedCount > 0 ? adjudicated / ingestedAssumedCount : null
  const expensiveOnly = query?.expensiveOnly === true
  const unanchoredRateCohortCount = expensiveOnly
    ? countAssumedIngestCohort(db, sinceIso, undefined, true)
    : ingestedAssumedCount
  const unanchoredAssumedInWindow = countUnanchoredInAssumedCohort(db, sinceIso, expensiveOnly)
  const unanchoredRate =
    unanchoredRateCohortCount > 0 ? unanchoredAssumedInWindow / unanchoredRateCohortCount : null
  const ratifyRatio = adjudicated > 0 ? ratifiedCount / adjudicated : null
  const reverseRatio = adjudicated > 0 ? reversedCount / adjudicated : null
  const adoptCount = countAdjudicationKindInWindow(db, sinceIso, 'adopt')
  const fixCount = countAdjudicationKindInWindow(db, sinceIso, 'fix')

  return {
    window,
    ingestedAssumedCount,
    pendingCount,
    ratifiedCount,
    reversedCount,
    adjudicationRate,
    scopeConflictCount,
    unanchoredCount,
    unanchoredRate,
    adjudicationLatencyP50Ms: adjudicationLatencyP50Ms(db, sinceIso),
    ratifyRatio,
    reverseRatio,
    adoptCount,
    fixCount,
  }
}

export function countIntentLedgerEntriesForTask(db: DatabaseSync, taskId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM intent_ledger WHERE task_id = ?')
    .get(taskId) as { count: number }
  return row.count
}

/** Entries injected into established-decisions (human-ratified plus S1 required/designed). */
export function listSupplyIntentLedger(db: DatabaseSync): IntentLedgerRecord[] {
  const rows = db
    .prepare(
      `
        SELECT ${INTENT_LEDGER_SELECT_COLUMNS}
        FROM intent_ledger
        WHERE authority IN ('ratified', 'required', 'designed')
        ORDER BY created_at ASC
      `,
    )
    .all() as unknown as IntentLedgerRow[]
  return rows.map(rowToRecord)
}

export function listIntentLedgerByIds(
  db: DatabaseSync,
  entryIds: readonly string[],
): IntentLedgerRecord[] {
  if (entryIds.length === 0) return []
  const placeholders = entryIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `
        SELECT ${INTENT_LEDGER_SELECT_COLUMNS}
        FROM intent_ledger
        WHERE id IN (${placeholders})
        ORDER BY created_at ASC
      `,
    )
    .all(...entryIds) as unknown as IntentLedgerRow[]
  return rows.map(rowToRecord)
}

export function getIntentLedgerEntryById(
  db: DatabaseSync,
  entryId: string,
): IntentLedgerRecord | null {
  const row = db
    .prepare(
      `
        SELECT ${INTENT_LEDGER_SELECT_COLUMNS}
        FROM intent_ledger
        WHERE id = ?
      `,
    )
    .get(entryId) as unknown as IntentLedgerRow | undefined
  return row ? rowToRecord(row) : null
}

export function ratifyIntentLedgerEntry(db: DatabaseSync, entryId: string): boolean {
  const ratifiedAt = new Date().toISOString()
  const result = db
    .prepare(
      `
        UPDATE intent_ledger
        SET authority = 'ratified', ratified_at = ?, adjudication_kind = 'ratify'
        WHERE id = ? AND authority = 'assumed' AND ratified_at IS NULL
      `,
    )
    .run(ratifiedAt, entryId)
  return result.changes > 0
}

export function reverseIntentLedgerEntry(db: DatabaseSync, entryId: string): boolean {
  const ratifiedAt = new Date().toISOString()
  const result = db
    .prepare(
      `
        UPDATE intent_ledger
        SET authority = 'reversed', ratified_at = ?, adjudication_kind = 'reverse'
        WHERE id = ? AND authority = 'assumed' AND ratified_at IS NULL
      `,
    )
    .run(ratifiedAt, entryId)
  return result.changes > 0
}

export function adoptIntentLedgerEntry(
  db: DatabaseSync,
  input: IntentLedgerAdjudicateInput,
): boolean {
  const ratifiedAt = new Date().toISOString()
  const result = db
    .prepare(
      `
        UPDATE intent_ledger
        SET authority = 'ratified',
            ratified_at = ?,
            adjudication_kind = 'adopt',
            adjudication_reason = ?,
            promoted_req_id = COALESCE(?, promoted_req_id)
        WHERE id = ?
          AND authority IN ('assumed', 'observed')
          AND ratified_at IS NULL
      `,
    )
    .run(
      ratifiedAt,
      input.reason?.trim() || null,
      input.promotedReqId?.trim() || null,
      input.entryId,
    )
  return result.changes > 0
}

export function setIntentLedgerPromotedReqId(
  db: DatabaseSync,
  entryId: string,
  promotedReqId: string,
): boolean {
  const trimmed = promotedReqId.trim()
  if (!trimmed) return false
  const result = db
    .prepare(
      `
        UPDATE intent_ledger
        SET promoted_req_id = ?
        WHERE id = ?
          AND authority = 'ratified'
          AND adjudication_kind = 'adopt'
      `,
    )
    .run(trimmed, entryId)
  return result.changes > 0
}

export function fixIntentLedgerEntry(
  db: DatabaseSync,
  input: IntentLedgerAdjudicateInput,
): boolean {
  const ratifiedAt = new Date().toISOString()
  const result = db
    .prepare(
      `
        UPDATE intent_ledger
        SET authority = 'reversed',
            ratified_at = ?,
            adjudication_kind = 'fix',
            adjudication_reason = ?
        WHERE id = ?
          AND authority IN ('assumed', 'observed')
          AND ratified_at IS NULL
      `,
    )
    .run(ratifiedAt, input.reason?.trim() || null, input.entryId)
  return result.changes > 0
}

export function upsertIntentLedgerEntry(db: DatabaseSync, input: IntentLedgerUpsertInput): void {
  const id = intentLedgerId(input.taskId, input.sourceRun, input.decisionId)
  db.prepare(
    `
      INSERT INTO intent_ledger (
        id, task_id, source_run, decision_id, statement, authority,
        scope_hint, source_doc, source_run_doc, created_at, ratified_at, reversibility,
        satisfies_json, deviates_json, observed_unanchored
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(task_id, source_run, decision_id) DO UPDATE SET
        statement = excluded.statement,
        authority = CASE
          WHEN intent_ledger.authority IN ('ratified', 'reversed') THEN intent_ledger.authority
          ELSE excluded.authority
        END,
        scope_hint = excluded.scope_hint,
        source_doc = excluded.source_doc,
        source_run_doc = excluded.source_run_doc,
        created_at = excluded.created_at,
        reversibility = excluded.reversibility,
        satisfies_json = CASE
          WHEN intent_ledger.authority IN ('ratified', 'reversed') THEN intent_ledger.satisfies_json
          ELSE excluded.satisfies_json
        END,
        deviates_json = CASE
          WHEN intent_ledger.authority IN ('ratified', 'reversed') THEN intent_ledger.deviates_json
          ELSE excluded.deviates_json
        END,
        observed_unanchored = CASE
          WHEN intent_ledger.authority IN ('ratified', 'reversed') THEN intent_ledger.observed_unanchored
          ELSE excluded.observed_unanchored
        END
    `,
  ).run(
    id,
    input.taskId,
    input.sourceRun,
    input.decisionId,
    input.statement,
    input.authority,
    input.scopeHint ?? null,
    input.sourceDoc ?? null,
    input.sourceRunDoc ?? null,
    input.createdAt,
    input.reversibility ?? null,
    serializeJsonStringArray(input.satisfies),
    serializeJsonStringArray(input.deviates),
    serializeObservedUnanchored(input.observedUnanchored),
  )
}
