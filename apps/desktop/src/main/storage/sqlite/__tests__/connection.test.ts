import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, closeSidecarSqlite, openSidecarSqlite } from '../connection.js'
import { readKvJson, writeKvJson } from '../kv-store.js'
import { SQLITE_SCHEMA_VERSION } from '../schema-v1.js'

describe('sqlite sidecar connection', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('initializes schema and user_version on first open', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-sqlite-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    const db = await openSidecarSqlite(paths)
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'kv_store'")
      .get() as { name?: string } | undefined
    expect(table?.name).toBe('kv_store')

    const version = db.prepare('PRAGMA user_version;').get() as
      | { user_version?: number }
      | undefined
    expect(version?.user_version).toBe(SQLITE_SCHEMA_VERSION)
  })

  it('keeps kv values across close/open', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-sqlite-persist-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    const first = await openSidecarSqlite(paths)
    writeKvJson(first, 'test.key', { ok: true })
    closeSidecarSqlite(paths)

    const reopened = await openSidecarSqlite(paths)
    expect(readKvJson(reopened, 'test.key')).toEqual({ ok: true })
  })
})
