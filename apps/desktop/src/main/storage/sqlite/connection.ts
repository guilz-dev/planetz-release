import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SidecarPaths } from '../../sidecar/sidecar-paths.js'
import { runSchemaMigrations } from './schema-migrations.js'
import { SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from './schema-v1.js'

const SQLITE_BUSY_TIMEOUT_MS = 5_000
const sqliteConnections = new Map<string, DatabaseSync>()
const sqliteOpenPromises = new Map<string, Promise<DatabaseSync>>()

function applyPragmas(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA synchronous = NORMAL;')
  db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};`)
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(SCHEMA_V1_SQL)
  const row = db.prepare('PRAGMA user_version;').get() as { user_version?: number } | undefined
  const fromVersion = row?.user_version ?? 0
  if (fromVersion < SQLITE_SCHEMA_VERSION) {
    runSchemaMigrations(db, fromVersion, SQLITE_SCHEMA_VERSION)
    db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};`)
  }
}

async function createSqliteConnection(sqlitePath: string): Promise<DatabaseSync> {
  await mkdir(dirname(sqlitePath), { recursive: true })
  const db = new DatabaseSync(sqlitePath)
  applyPragmas(db)
  initializeSchema(db)
  return db
}

export async function openSidecarSqlite(paths: SidecarPaths): Promise<DatabaseSync> {
  const cached = sqliteConnections.get(paths.sqlitePath)
  if (cached) return cached

  const inflight = sqliteOpenPromises.get(paths.sqlitePath)
  if (inflight) return inflight

  const opening = createSqliteConnection(paths.sqlitePath)
    .then((db) => {
      sqliteConnections.set(paths.sqlitePath, db)
      sqliteOpenPromises.delete(paths.sqlitePath)
      return db
    })
    .catch((error: unknown) => {
      sqliteOpenPromises.delete(paths.sqlitePath)
      throw error
    })
  sqliteOpenPromises.set(paths.sqlitePath, opening)
  return opening
}

export async function getSidecarSqlite(paths: SidecarPaths): Promise<DatabaseSync> {
  return openSidecarSqlite(paths)
}

export function closeSidecarSqlite(paths: SidecarPaths): void {
  const db = sqliteConnections.get(paths.sqlitePath)
  if (!db) return
  sqliteConnections.delete(paths.sqlitePath)
  sqliteOpenPromises.delete(paths.sqlitePath)
  db.close()
}

export function closeAllSidecarSqlite(): void {
  for (const db of sqliteConnections.values()) {
    db.close()
  }
  sqliteConnections.clear()
  sqliteOpenPromises.clear()
}
