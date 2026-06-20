import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import {
  listArtifactsForThread,
  saveArtifactRefs,
} from '../repositories/conversation-artifact-repository.js'
import { insertConversationThread } from '../repositories/conversation-ledger-repository.js'

const WORKSPACE = '/tmp/planetz-artifact-ws'
const TS = '2026-06-01T10:00:00.000Z'

describe('conversation-artifact-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  async function openDb() {
    const root = await mkdtemp(join(tmpdir(), 'conv-artifact-'))
    roots.push(root)
    return openSidecarSqlite(mockSidecarPaths(root))
  }

  it('saves and lists artifacts for a thread', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_1',
      workspacePath: WORKSPACE,
      title: 'Test',
      updatedAt: TS,
    })
    saveArtifactRefs(db, 'thr_1', [
      { kind: 'file', ref: 'src/a.ts', priority: 'normal', contentHash: 'hash_a' },
      { kind: 'log', ref: 'build.log', priority: 'low' },
    ])
    const rows = listArtifactsForThread(db, 'thr_1')
    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.kind === 'file')).toBe(true)
  })

  it('stores compaction summary artifacts', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_sum',
      workspacePath: WORKSPACE,
      title: 'Test',
      updatedAt: TS,
    })
    saveArtifactRefs(
      db,
      'thr_sum',
      [{ kind: 'summary', ref: 'compaction-thr_sum', priority: 'high' }],
      new Map([['summary:compaction-thr_sum', '{"estimatedTokensBefore":1}']]),
    )
    const rows = listArtifactsForThread(db, 'thr_sum')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('summary')
    expect(rows[0]?.payload_json).toContain('estimatedTokensBefore')
  })
})
