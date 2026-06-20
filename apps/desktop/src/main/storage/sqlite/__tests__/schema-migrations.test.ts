import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { PLANETZ_SQLITE_FILENAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import { runSchemaMigrations } from '../schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

describe('schema migrations', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('migrates v3 databases to v5 with conversation ledger tables', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v3-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 3)
    legacy.exec('PRAGMA user_version = 3;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const threads = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversation_threads'",
      )
      .get() as { name?: string } | undefined
    expect(threads?.name).toBe('conversation_threads')

    const uniqueIndex = db
      .prepare(
        `
          SELECT name FROM sqlite_master
          WHERE type = 'index' AND name = 'idx_conversation_turns_thread_turn_index'
        `,
      )
      .get() as { name?: string } | undefined
    expect(uniqueIndex?.name).toBe('idx_conversation_turns_thread_turn_index')

    const sessionPolicyCol = db
      .prepare('PRAGMA table_info(conversation_threads)')
      .all()
      .find((row) => (row as { name?: string }).name === 'session_policy')
    expect(sessionPolicyCol).toBeDefined()

    const intentLedger = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'intent_ledger'")
      .get() as { name?: string } | undefined
    expect(intentLedger?.name).toBe('intent_ledger')

    const reversibilityCol = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .find((row) => (row as { name?: string }).name === 'reversibility')
    expect(reversibilityCol).toBeDefined()

    const satisfiesCol = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .find((row) => (row as { name?: string }).name === 'satisfies_json')
    expect(satisfiesCol).toBeDefined()

    const workflowSelectionMeta = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_workflow_selection_meta'",
      )
      .get() as { name?: string } | undefined
    expect(workflowSelectionMeta?.name).toBe('task_workflow_selection_meta')
  })

  it('migrates v11 databases to v12 with intent_ledger trace columns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v11-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 11)
    legacy.exec('PRAGMA user_version = 11;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const satisfiesCol = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .find((row) => (row as { name?: string }).name === 'satisfies_json')
    const deviatesCol = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .find((row) => (row as { name?: string }).name === 'deviates_json')
    expect(satisfiesCol).toBeDefined()
    expect(deviatesCol).toBeDefined()
  })

  it('migrates v12 databases to v13 with observed authority check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v12-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 12)
    legacy.exec('PRAGMA user_version = 12;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const ddl = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'intent_ledger'")
      .get() as { sql?: string } | undefined
    expect(ddl?.sql).toContain("'observed'")

    db.prepare(
      `
        INSERT INTO intent_ledger (
          id, task_id, source_run, decision_id, statement, authority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run('t:r:o', 't', 'r', 'o', 'Observed row', 'observed', '2026-06-10T00:00:00.000Z')
    const row = db.prepare('SELECT authority FROM intent_ledger WHERE id = ?').get('t:r:o') as {
      authority?: string
    }
    expect(row.authority).toBe('observed')
  })

  it('migrates v13 databases to v14 with observed_unanchored column', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v13-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 13)
    legacy.exec('PRAGMA user_version = 13;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const observedUnanchoredCol = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .find((row) => (row as { name?: string }).name === 'observed_unanchored')
    expect(observedUnanchoredCol).toBeDefined()
  })

  it('migrates v14 databases to v15 with adjudication audit columns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v14-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 14)
    legacy.exec('PRAGMA user_version = 14;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const columns = db
      .prepare('PRAGMA table_info(intent_ledger)')
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(columns).toContain('adjudication_kind')
    expect(columns).toContain('adjudication_reason')
    expect(columns).toContain('promoted_req_id')
  })

  it('migrates v15 databases to v16 with task_thread_link table', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v15-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 15)
    legacy.exec('PRAGMA user_version = 15;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(tables).toContain('task_thread_link')
  })

  it('migrates v16 databases to v17 with decided_intent table', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v16-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 16)
    legacy.exec('PRAGMA user_version = 16;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(tables).toContain('decided_intent')
  })

  it('migrates v17 databases to v18 with task_supply_snapshot table', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v17-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 17)
    legacy.exec('PRAGMA user_version = 17;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(tables).toContain('task_supply_snapshot')
  })

  it('migrates v18 databases to v19 with requirement intent link tables', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-migrate-v18-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })
    const sqlitePath = join(sidecarRoot, PLANETZ_SQLITE_FILENAME)

    const legacy = new DatabaseSync(sqlitePath)
    legacy.exec('PRAGMA foreign_keys = ON;')
    legacy.exec(SCHEMA_V1_SQL)
    runSchemaMigrations(legacy, 0, 18)
    legacy.exec('PRAGMA user_version = 18;')
    legacy.close()

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(tables).toContain('requirement_intent_link')
    expect(tables).toContain('task_intent_context_snapshot')
  })

  it('fresh sidecar database includes task_supply_snapshot at current schema version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'schema-fresh-'))
    roots.push(root)
    const sidecarRoot = join(root, 'sidecar')
    await mkdir(sidecarRoot, { recursive: true })

    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)

    const version = db.prepare('PRAGMA user_version;').get() as { user_version?: number }
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name?: string }).name)
    expect(tables).toContain('task_supply_snapshot')
  })
})
