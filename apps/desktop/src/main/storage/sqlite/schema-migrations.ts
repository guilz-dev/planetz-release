import type { DatabaseSync } from 'node:sqlite'
import { CONVERSATION_THREAD_STATUSES, DEFAULT_CONVERSATION_THREAD_STATUS } from '@planetz/shared'

const CONVERSATION_THREAD_STATUS_CHECK = CONVERSATION_THREAD_STATUSES.map((s) => `'${s}'`).join(
  ', ',
)

function promptHistoryHasColumn(db: DatabaseSync, column: string): boolean {
  const rows = db.prepare('PRAGMA table_info(prompt_history)').all() as Array<{ name?: string }>
  return rows.some((row) => row.name === column)
}

function migrateV1ToV2(db: DatabaseSync): void {
  if (!promptHistoryHasColumn(db, 'auto_decision_json')) {
    db.exec('ALTER TABLE prompt_history ADD COLUMN auto_decision_json TEXT')
  }
}

function migrateV2ToV3(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_pr_links (
      task_id TEXT PRIMARY KEY,
      branch TEXT NOT NULL,
      repo TEXT NOT NULL,
      number INTEGER NOT NULL,
      url TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
      is_draft INTEGER NOT NULL,
      base_branch TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

function migrateV3ToV4(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_threads (
      thread_id TEXT PRIMARY KEY,
      workspace_path TEXT NOT NULL,
      branch TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '${DEFAULT_CONVERSATION_THREAD_STATUS}' CHECK (status IN (${CONVERSATION_THREAD_STATUS_CHECK})),
      updated_at TEXT NOT NULL,
      active_session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_threads_ws_updated
      ON conversation_threads(workspace_path, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversation_threads_ws_status_updated
      ON conversation_threads(workspace_path, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS conversation_turns (
      turn_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      turn_index INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      provider TEXT,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(thread_id, turn_index),
      FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_turns_thread_index
      ON conversation_turns(thread_id, turn_index);

    CREATE TABLE IF NOT EXISTS conversation_artifacts (
      artifact_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      artifact_ref TEXT NOT NULL,
      kind TEXT NOT NULL,
      priority TEXT CHECK (priority IS NULL OR priority IN ('high', 'normal', 'low')),
      content_hash TEXT,
      payload_json TEXT,
      FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_artifacts_thread
      ON conversation_artifacts(thread_id);
  `)
}

function migrateV4ToV5(db: DatabaseSync): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_turns_thread_turn_index
      ON conversation_turns(thread_id, turn_index);
  `)
}

function migrateV5ToV6(db: DatabaseSync): void {
  if (!promptHistoryHasColumn(db, 'issue_ref')) {
    db.exec('ALTER TABLE prompt_history ADD COLUMN issue_ref TEXT')
  }
}

function migrateV6ToV7(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_routing_audit (
      task_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
}

function conversationThreadsHasColumn(db: DatabaseSync, column: string): boolean {
  const rows = db.prepare('PRAGMA table_info(conversation_threads)').all() as Array<{
    name?: string
  }>
  return rows.some((row) => row.name === column)
}

function migrateV7ToV8(db: DatabaseSync): void {
  if (!conversationThreadsHasColumn(db, 'session_policy')) {
    db.exec('ALTER TABLE conversation_threads ADD COLUMN session_policy TEXT')
  }
}

function intentLedgerHasColumn(db: DatabaseSync, column: string): boolean {
  const rows = db.prepare('PRAGMA table_info(intent_ledger)').all() as Array<{ name?: string }>
  return rows.some((row) => row.name === column)
}

function migrateV8ToV9(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS intent_ledger (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      source_run TEXT NOT NULL,
      decision_id TEXT NOT NULL,
      statement TEXT NOT NULL,
      authority TEXT NOT NULL CHECK (authority IN ('required', 'designed', 'assumed', 'ratified', 'reversed')),
      scope_hint TEXT,
      source_doc TEXT,
      source_run_doc TEXT,
      created_at TEXT NOT NULL,
      ratified_at TEXT,
      UNIQUE(task_id, source_run, decision_id)
    );
    CREATE INDEX IF NOT EXISTS idx_intent_ledger_task_id ON intent_ledger(task_id);
    CREATE INDEX IF NOT EXISTS idx_intent_ledger_source_run ON intent_ledger(source_run);
  `)
}

function migrateV9ToV10(db: DatabaseSync): void {
  if (!intentLedgerHasColumn(db, 'reversibility')) {
    db.exec(`
      ALTER TABLE intent_ledger ADD COLUMN reversibility TEXT
        CHECK (reversibility IN ('cheap', 'expensive') OR reversibility IS NULL);
    `)
  }
}

function migrateV10ToV11(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_workflow_selection_meta (
      task_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('auto', 'modified', 'manual')),
      base_workflow TEXT NOT NULL,
      resolved_workflow TEXT,
      run_override_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_workflow_selection_meta_updated
      ON task_workflow_selection_meta(updated_at DESC);
  `)
}

function migrateV11ToV12(db: DatabaseSync): void {
  if (!intentLedgerHasColumn(db, 'satisfies_json')) {
    db.exec('ALTER TABLE intent_ledger ADD COLUMN satisfies_json TEXT')
  }
  if (!intentLedgerHasColumn(db, 'deviates_json')) {
    db.exec('ALTER TABLE intent_ledger ADD COLUMN deviates_json TEXT')
  }
}

function intentLedgerAuthorityCheckIncludesObserved(db: DatabaseSync): boolean {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'intent_ledger'")
    .get() as { sql?: string } | undefined
  return row?.sql?.includes("'observed'") ?? false
}

function migrateV12ToV13(db: DatabaseSync): void {
  if (intentLedgerAuthorityCheckIncludesObserved(db)) return

  db.exec('PRAGMA foreign_keys = OFF')
  db.exec(`
    CREATE TABLE intent_ledger_v13 (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      source_run TEXT NOT NULL,
      decision_id TEXT NOT NULL,
      statement TEXT NOT NULL,
      authority TEXT NOT NULL CHECK (authority IN ('required', 'designed', 'assumed', 'observed', 'ratified', 'reversed')),
      scope_hint TEXT,
      source_doc TEXT,
      source_run_doc TEXT,
      created_at TEXT NOT NULL,
      ratified_at TEXT,
      reversibility TEXT CHECK (reversibility IN ('cheap', 'expensive') OR reversibility IS NULL),
      satisfies_json TEXT,
      deviates_json TEXT,
      UNIQUE(task_id, source_run, decision_id)
    );
    INSERT INTO intent_ledger_v13 (
      id, task_id, source_run, decision_id, statement, authority,
      scope_hint, source_doc, source_run_doc, created_at, ratified_at,
      reversibility, satisfies_json, deviates_json
    )
    SELECT
      id, task_id, source_run, decision_id, statement, authority,
      scope_hint, source_doc, source_run_doc, created_at, ratified_at,
      reversibility, satisfies_json, deviates_json
    FROM intent_ledger;
    DROP TABLE intent_ledger;
    ALTER TABLE intent_ledger_v13 RENAME TO intent_ledger;
    CREATE INDEX IF NOT EXISTS idx_intent_ledger_task_id ON intent_ledger(task_id);
    CREATE INDEX IF NOT EXISTS idx_intent_ledger_source_run ON intent_ledger(source_run);
  `)
  db.exec('PRAGMA foreign_keys = ON')
}

function migrateV13ToV14(db: DatabaseSync): void {
  if (!intentLedgerHasColumn(db, 'observed_unanchored')) {
    db.exec('ALTER TABLE intent_ledger ADD COLUMN observed_unanchored INTEGER')
  }
}

function migrateV14ToV15(db: DatabaseSync): void {
  if (!intentLedgerHasColumn(db, 'adjudication_kind')) {
    db.exec(`
      ALTER TABLE intent_ledger ADD COLUMN adjudication_kind TEXT
        CHECK (adjudication_kind IN ('adopt', 'fix', 'ratify', 'reverse') OR adjudication_kind IS NULL)
    `)
  }
  if (!intentLedgerHasColumn(db, 'adjudication_reason')) {
    db.exec('ALTER TABLE intent_ledger ADD COLUMN adjudication_reason TEXT')
  }
  if (!intentLedgerHasColumn(db, 'promoted_req_id')) {
    db.exec('ALTER TABLE intent_ledger ADD COLUMN promoted_req_id TEXT')
  }
}

function migrateV15ToV16(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_thread_link (
      task_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_thread_link_thread
      ON task_thread_link(thread_id);
  `)
}

function migrateV16ToV17(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decided_intent (
      thread_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      what TEXT NOT NULL,
      why TEXT NOT NULL,
      out_of_scope TEXT NOT NULL DEFAULT '[]',
      reason TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_decided_intent_thread
      ON decided_intent(thread_id);
  `)
}

function migrateV17ToV18(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_supply_snapshot (
      task_id TEXT PRIMARY KEY,
      entry_ids_json TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      match_basis TEXT NOT NULL
    );
  `)
}

function migrateV18ToV19(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requirement_intent_link (
      req_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      decided_intent_version INTEGER NOT NULL,
      rationale TEXT NOT NULL,
      source_task_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (req_id, thread_id)
    );
    CREATE INDEX IF NOT EXISTS idx_requirement_intent_link_thread
      ON requirement_intent_link(thread_id);

    CREATE TABLE IF NOT EXISTS task_intent_context_snapshot (
      task_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      decided_intent_version INTEGER NOT NULL,
      captured_at TEXT NOT NULL
    );
  `)
}

/** Apply incremental schema changes after base DDL. */
export function runSchemaMigrations(
  db: DatabaseSync,
  fromVersion: number,
  toVersion: number,
): void {
  if (fromVersion < 2 && toVersion >= 2) {
    migrateV1ToV2(db)
  }
  if (fromVersion < 3 && toVersion >= 3) {
    migrateV2ToV3(db)
  }
  if (fromVersion < 4 && toVersion >= 4) {
    migrateV3ToV4(db)
  }
  if (fromVersion < 5 && toVersion >= 5) {
    migrateV4ToV5(db)
  }
  if (fromVersion < 6 && toVersion >= 6) {
    migrateV5ToV6(db)
  }
  if (fromVersion < 7 && toVersion >= 7) {
    migrateV6ToV7(db)
  }
  if (fromVersion < 8 && toVersion >= 8) {
    migrateV7ToV8(db)
  }
  if (fromVersion < 9 && toVersion >= 9) {
    migrateV8ToV9(db)
  }
  if (fromVersion < 10 && toVersion >= 10) {
    migrateV9ToV10(db)
  }
  if (fromVersion < 11 && toVersion >= 11) {
    migrateV10ToV11(db)
  }
  if (fromVersion < 12 && toVersion >= 12) {
    migrateV11ToV12(db)
  }
  if (fromVersion < 13 && toVersion >= 13) {
    migrateV12ToV13(db)
  }
  if (fromVersion < 14 && toVersion >= 14) {
    migrateV13ToV14(db)
  }
  if (fromVersion < 15 && toVersion >= 15) {
    migrateV14ToV15(db)
  }
  if (fromVersion < 16 && toVersion >= 16) {
    migrateV15ToV16(db)
  }
  if (fromVersion < 17 && toVersion >= 17) {
    migrateV16ToV17(db)
  }
  if (fromVersion < 18 && toVersion >= 18) {
    migrateV17ToV18(db)
  }
  if (fromVersion < 19 && toVersion >= 19) {
    migrateV18ToV19(db)
  }
}
