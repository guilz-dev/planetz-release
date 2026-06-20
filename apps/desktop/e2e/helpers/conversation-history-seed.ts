import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { PLANETZ_SQLITE_FILENAME, SIDECAR_DIR_NAME } from '@planetz/shared'
import {
  insertConversationThread,
  insertConversationTurn,
} from '../../src/main/storage/sqlite/repositories/conversation-ledger-repository.js'
import { runSchemaMigrations } from '../../src/main/storage/sqlite/schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../../src/main/storage/sqlite/schema-v1.js'

const SEED_THREAD_ID = 'e2e_conv_restart_thr'
const SEED_SESSION_ID = 'e2e_conv_restart_sess'
const SEED_TURN_TS = '2026-06-01T12:00:00.000Z'

export const E2E_CONVERSATION_RESTART_THREAD_ID = SEED_THREAD_ID
export const E2E_CONVERSATION_RESTART_SESSION_ID = SEED_SESSION_ID

function openWorkspaceSqlite(workspacePath: string): DatabaseSync {
  const sqlitePath = join(workspacePath, SIDECAR_DIR_NAME, PLANETZ_SQLITE_FILENAME)
  mkdirSync(join(workspacePath, SIDECAR_DIR_NAME), { recursive: true })
  const db = new DatabaseSync(sqlitePath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_V1_SQL)
  const row = db.prepare('PRAGMA user_version;').get() as { user_version?: number } | undefined
  const fromVersion = row?.user_version ?? 0
  if (fromVersion < SQLITE_SCHEMA_VERSION) {
    runSchemaMigrations(db, fromVersion, SQLITE_SCHEMA_VERSION)
    db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};`)
  }
  return db
}

/** Seeds an open conversation thread with turns for restart persistence E2E. */
export function seedConversationHistoryForRestartE2e(workspacePath: string): void {
  const db = openWorkspaceSqlite(workspacePath)
  try {
    insertConversationThread(db, {
      threadId: SEED_THREAD_ID,
      workspacePath,
      branch: 'main',
      title: 'E2E restart conversation',
      updatedAt: SEED_TURN_TS,
      activeSessionId: SEED_SESSION_ID,
    })
    insertConversationTurn(db, {
      turnId: 'e2e_turn_user',
      threadId: SEED_THREAD_ID,
      turnIndex: 0,
      role: 'user',
      content: 'Hello before restart',
      createdAt: SEED_TURN_TS,
    })
    insertConversationTurn(db, {
      turnId: 'e2e_turn_assistant',
      threadId: SEED_THREAD_ID,
      turnIndex: 1,
      role: 'assistant',
      content: 'Reply before restart',
      createdAt: SEED_TURN_TS,
    })
  } finally {
    db.close()
  }
}
