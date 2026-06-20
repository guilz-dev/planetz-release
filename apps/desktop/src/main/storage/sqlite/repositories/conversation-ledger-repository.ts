import { basename } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  ARCHIVED_CONVERSATION_THREAD_STATUS,
  CONVERSATION_HISTORY_DEFAULT_LIST_LIMIT,
  CONVERSATION_HISTORY_MAX_LIST_LIMIT,
  type ConversationHistoryThreadSummary,
  type ConversationHistoryTurn,
  type ConversationThreadStatus,
  DEFAULT_CONVERSATION_THREAD_STATUS,
  DEFAULT_CONVERSATION_THREAD_TITLE,
  type PlanetzSessionPolicy,
  planetzSessionPolicySchema,
} from '@planetz/shared'
import { runSidecarTransaction } from '../transaction.js'

const THREAD_SUMMARY_COLUMNS =
  'thread_id, workspace_path, branch, title, status, updated_at, active_session_id, session_policy'

const THREAD_SUMMARY_COLUMNS_T =
  't.thread_id, t.workspace_path, t.branch, t.title, t.status, t.updated_at, t.active_session_id, t.session_policy'

const TURN_ROW_COLUMNS =
  'turn_id, thread_id, turn_index, role, provider, content, metadata_json, created_at'

export type ConversationLedgerThreadRow = {
  thread_id: string
  workspace_path: string
  branch: string | null
  title: string
  status: ConversationThreadStatus
  updated_at: string
  active_session_id: string | null
  session_policy: string | null
}

type ConversationLedgerTurnRow = {
  turn_id: string
  thread_id: string
  turn_index: number
  role: 'user' | 'assistant'
  provider: string | null
  content: string
  metadata_json: string | null
  created_at: string
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function likePatternContains(query: string): string {
  return `%${escapeLikePattern(query)}%`
}

function resolveListLimit(limit: number | undefined): number {
  if (limit === undefined) return CONVERSATION_HISTORY_DEFAULT_LIST_LIMIT
  return Math.min(Math.max(1, limit), CONVERSATION_HISTORY_MAX_LIST_LIMIT)
}

function parseStoredSessionPolicy(raw: string | null): PlanetzSessionPolicy | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  const parsed = planetzSessionPolicySchema.safeParse(trimmed)
  return parsed.success ? parsed.data : undefined
}

function rowToThreadSummary(row: ConversationLedgerThreadRow): ConversationHistoryThreadSummary {
  const hasActiveSession = row.active_session_id != null && row.active_session_id.length > 0
  const sessionPolicy = parseStoredSessionPolicy(row.session_policy)
  return {
    threadId: row.thread_id,
    title: row.title,
    workspacePath: row.workspace_path,
    workspaceLabel: basename(row.workspace_path),
    updatedAt: row.updated_at,
    hasActiveSession,
    ...(hasActiveSession && row.active_session_id
      ? { activeSessionId: row.active_session_id }
      : {}),
    ...(sessionPolicy ? { sessionPolicy } : {}),
  }
}

function rowToTurn(row: ConversationLedgerTurnRow): ConversationHistoryTurn {
  return {
    turnId: row.turn_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function insertConversationThread(
  db: DatabaseSync,
  input: {
    threadId: string
    workspacePath: string
    branch?: string | null
    title: string
    status?: ConversationThreadStatus
    updatedAt: string
    activeSessionId?: string | null
    sessionPolicy?: PlanetzSessionPolicy | null
  },
): void {
  db.prepare(
    `
      INSERT INTO conversation_threads (
        thread_id, workspace_path, branch, title, status, updated_at, active_session_id, session_policy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    input.threadId,
    input.workspacePath,
    input.branch ?? null,
    input.title,
    input.status ?? DEFAULT_CONVERSATION_THREAD_STATUS,
    input.updatedAt,
    input.activeSessionId ?? null,
    input.sessionPolicy ?? null,
  )
}

export function insertConversationTurn(
  db: DatabaseSync,
  input: {
    turnId: string
    threadId: string
    turnIndex: number
    role: 'user' | 'assistant'
    provider?: string | null
    content: string
    metadataJson?: string | null
    createdAt: string
  },
): void {
  db.prepare(
    `
      INSERT INTO conversation_turns (
        turn_id, thread_id, turn_index, role, provider, content, metadata_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    input.turnId,
    input.threadId,
    input.turnIndex,
    input.role,
    input.provider ?? null,
    input.content,
    input.metadataJson ?? null,
    input.createdAt,
  )
}

export function listOpenThreads(
  db: DatabaseSync,
  workspacePath: string,
  limit?: number,
): ConversationHistoryThreadSummary[] {
  const resolvedLimit = resolveListLimit(limit)
  const rows = db
    .prepare(
      `
        SELECT ${THREAD_SUMMARY_COLUMNS}
        FROM conversation_threads
        WHERE workspace_path = ? AND status = ?
        ORDER BY updated_at DESC, thread_id DESC
        LIMIT ?
      `,
    )
    .all(
      workspacePath,
      DEFAULT_CONVERSATION_THREAD_STATUS,
      resolvedLimit,
    ) as ConversationLedgerThreadRow[]
  return rows.map(rowToThreadSummary)
}

function getThreadRow(
  db: DatabaseSync,
  threadId: string,
  workspacePath: string,
): ConversationLedgerThreadRow | null {
  const row = db
    .prepare(
      `
        SELECT ${THREAD_SUMMARY_COLUMNS}
        FROM conversation_threads
        WHERE thread_id = ? AND workspace_path = ?
      `,
    )
    .get(threadId, workspacePath) as ConversationLedgerThreadRow | undefined
  return row ?? null
}

function listTurnsForThread(db: DatabaseSync, threadId: string): ConversationHistoryTurn[] {
  const rows = db
    .prepare(
      `
        SELECT ${TURN_ROW_COLUMNS}
        FROM conversation_turns
        WHERE thread_id = ?
        ORDER BY turn_index ASC, rowid ASC
      `,
    )
    .all(threadId) as ConversationLedgerTurnRow[]
  return rows.map(rowToTurn)
}

export function getThreadWithTurns(
  db: DatabaseSync,
  threadId: string,
  workspacePath: string,
): { thread: ConversationHistoryThreadSummary; turns: ConversationHistoryTurn[] } | null {
  const row = getThreadRow(db, threadId, workspacePath)
  if (!row) return null
  return {
    thread: rowToThreadSummary(row),
    turns: listTurnsForThread(db, threadId),
  }
}

export function deleteThread(db: DatabaseSync, threadId: string, workspacePath: string): boolean {
  const result = db
    .prepare(
      `
        DELETE FROM conversation_threads
        WHERE thread_id = ? AND workspace_path = ?
      `,
    )
    .run(threadId, workspacePath)
  return (result.changes ?? 0) > 0
}

export function archiveThread(db: DatabaseSync, threadId: string, workspacePath: string): boolean {
  const result = db
    .prepare(
      `
        UPDATE conversation_threads
        SET status = ?
        WHERE thread_id = ? AND workspace_path = ?
      `,
    )
    .run(ARCHIVED_CONVERSATION_THREAD_STATUS, threadId, workspacePath)
  return (result.changes ?? 0) > 0
}

export function searchOpenThreads(
  db: DatabaseSync,
  query: string,
  workspacePath: string,
  limit?: number,
): ConversationHistoryThreadSummary[] {
  const resolvedLimit = resolveListLimit(limit)
  const pattern = likePatternContains(query)
  const rows = db
    .prepare(
      `
        SELECT DISTINCT ${THREAD_SUMMARY_COLUMNS_T}
        FROM conversation_threads t
        WHERE t.workspace_path = ?
          AND t.status = ?
          AND (
            LOWER(t.title) LIKE LOWER(?) ESCAPE '\\'
            OR EXISTS (
              SELECT 1
              FROM conversation_turns ct
              WHERE ct.thread_id = t.thread_id
                AND LOWER(ct.content) LIKE LOWER(?) ESCAPE '\\'
            )
          )
        ORDER BY t.updated_at DESC, t.thread_id DESC
        LIMIT ?
      `,
    )
    .all(
      workspacePath,
      DEFAULT_CONVERSATION_THREAD_STATUS,
      pattern,
      pattern,
      resolvedLimit,
    ) as ConversationLedgerThreadRow[]
  return rows.map(rowToThreadSummary)
}

export function findOpenThreadWorkspaceByActiveSessionId(
  db: DatabaseSync,
  activeSessionId: string,
): string | null {
  const row = db
    .prepare(
      `
        SELECT workspace_path
        FROM conversation_threads
        WHERE active_session_id = ? AND status = ?
        LIMIT 1
      `,
    )
    .get(activeSessionId, DEFAULT_CONVERSATION_THREAD_STATUS) as
    | { workspace_path: string }
    | undefined
  return row?.workspace_path ?? null
}

export function findOpenThreadByActiveSessionId(
  db: DatabaseSync,
  activeSessionId: string,
  workspacePath: string,
): ConversationLedgerThreadRow | null {
  const row = db
    .prepare(
      `
        SELECT ${THREAD_SUMMARY_COLUMNS}
        FROM conversation_threads
        WHERE active_session_id = ? AND workspace_path = ? AND status = ?
        LIMIT 1
      `,
    )
    .get(activeSessionId, workspacePath, DEFAULT_CONVERSATION_THREAD_STATUS) as
    | ConversationLedgerThreadRow
    | undefined
  return row ?? null
}

function getNextTurnIndex(db: DatabaseSync, threadId: string): number {
  const row = db
    .prepare(
      `
        SELECT COALESCE(MAX(turn_index), -1) AS max_index
        FROM conversation_turns
        WHERE thread_id = ?
      `,
    )
    .get(threadId) as { max_index: number }
  return row.max_index + 1
}

export type ConversationLedgerTurnInsert = {
  turnId: string
  role: 'user' | 'assistant'
  provider?: string | null
  content: string
  metadataJson?: string | null
  createdAt: string
}

export function appendThreadTurnsTransactional(
  db: DatabaseSync,
  input: {
    threadId: string
    workspacePath: string
    turns: ConversationLedgerTurnInsert[]
    updatedAt: string
    titleFromFirstUserMessage?: string
  },
): void {
  if (input.turns.length === 0) return
  runSidecarTransaction(db, () => {
    const thread = getThreadRow(db, input.threadId, input.workspacePath)
    if (!thread) {
      throw new Error(`Conversation thread not found: ${input.threadId}`)
    }
    let turnIndex = getNextTurnIndex(db, input.threadId)
    for (const turn of input.turns) {
      insertConversationTurn(db, {
        turnId: turn.turnId,
        threadId: input.threadId,
        turnIndex,
        role: turn.role,
        provider: turn.provider,
        content: turn.content,
        metadataJson: turn.metadataJson,
        createdAt: turn.createdAt,
      })
      turnIndex += 1
    }
    const titleUpdate =
      input.titleFromFirstUserMessage &&
      (thread.title === DEFAULT_CONVERSATION_THREAD_TITLE || thread.title.trim() === '')
        ? input.titleFromFirstUserMessage
        : thread.title
    db.prepare(
      `
        UPDATE conversation_threads
        SET updated_at = ?, title = ?
        WHERE thread_id = ? AND workspace_path = ?
      `,
    ).run(input.updatedAt, titleUpdate, input.threadId, input.workspacePath)
  })
}

export function updateThreadTitleIfDefault(
  db: DatabaseSync,
  threadId: string,
  workspacePath: string,
  title: string,
  updatedAt: string,
): boolean {
  const result = db
    .prepare(
      `
        UPDATE conversation_threads
        SET title = ?, updated_at = ?
        WHERE thread_id = ? AND workspace_path = ?
          AND (title = ? OR trim(title) = '')
      `,
    )
    .run(title, updatedAt, threadId, workspacePath, DEFAULT_CONVERSATION_THREAD_TITLE)
  return (result.changes ?? 0) > 0
}

export function countTurnsForThread(db: DatabaseSync, threadId: string): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM conversation_turns
        WHERE thread_id = ?
      `,
    )
    .get(threadId) as { count: number }
  return row.count
}

export function rebindOpenThreadSession(
  db: DatabaseSync,
  input: {
    threadId: string
    workspacePath: string
    activeSessionId: string
    sessionPolicy: PlanetzSessionPolicy
    updatedAt: string
  },
): boolean {
  const result = db
    .prepare(
      `
        UPDATE conversation_threads
        SET active_session_id = ?, session_policy = ?, updated_at = ?
        WHERE thread_id = ? AND workspace_path = ? AND status = ?
      `,
    )
    .run(
      input.activeSessionId,
      input.sessionPolicy,
      input.updatedAt,
      input.threadId,
      input.workspacePath,
      DEFAULT_CONVERSATION_THREAD_STATUS,
    )
  return (result.changes ?? 0) > 0
}

export function clearActiveSessionId(
  db: DatabaseSync,
  threadId: string,
  workspacePath: string,
  updatedAt: string,
): boolean {
  const result = db
    .prepare(
      `
        UPDATE conversation_threads
        SET active_session_id = NULL, updated_at = ?
        WHERE thread_id = ? AND workspace_path = ?
      `,
    )
    .run(updatedAt, threadId, workspacePath)
  return (result.changes ?? 0) > 0
}
