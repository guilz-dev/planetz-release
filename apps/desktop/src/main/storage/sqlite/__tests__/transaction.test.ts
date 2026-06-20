import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import { readKvJson, writeKvJson } from '../kv-store.js'
import { runSidecarTransaction } from '../transaction.js'

describe('runSidecarTransaction', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('commits all writes made inside the callback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-sqlite-tx-commit-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const db = await openSidecarSqlite(paths)

    runSidecarTransaction(db, () => {
      writeKvJson(db, 'tx.a', { ok: true })
      writeKvJson(db, 'tx.b', { ok: true })
    })

    expect(readKvJson(db, 'tx.a')).toEqual({ ok: true })
    expect(readKvJson(db, 'tx.b')).toEqual({ ok: true })
  })

  it('rolls back all writes when the callback throws', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-sqlite-tx-rollback-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const db = await openSidecarSqlite(paths)

    writeKvJson(db, 'tx.seed', { kept: true })

    expect(() =>
      runSidecarTransaction(db, () => {
        writeKvJson(db, 'tx.fail', { ok: false })
        throw new Error('boom')
      }),
    ).toThrow('boom')

    expect(readKvJson(db, 'tx.seed')).toEqual({ kept: true })
    expect(readKvJson(db, 'tx.fail')).toBeNull()
  })
})
