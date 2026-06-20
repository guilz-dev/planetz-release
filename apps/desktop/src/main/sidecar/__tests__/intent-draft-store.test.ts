import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite } from '../../storage/sqlite/connection.js'
import { IntentDraftStore } from '../intent-draft-store.js'

describe('IntentDraftStore', () => {
  const roots: string[] = []
  let store: IntentDraftStore
  let paths: ReturnType<typeof mockSidecarPaths>

  beforeEach(async () => {
    store = new IntentDraftStore()
    const root = await mkdtemp(join(tmpdir(), 'intent-draft-store-'))
    roots.push(root)
    paths = mockSidecarPaths(root)
  })

  afterEach(async () => {
    await closeAllSidecarSqlite()
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  })

  it('saves and loads thread-scoped drafts', async () => {
    await store.save(paths, {
      threadId: 'thread-1',
      autoGenerate: true,
      what: 'Stabilize retries',
      why: 'Reduce payment failures',
      outOfScopeText: 'UI polish',
      touchedByUser: false,
      basedOnIntentVersion: null,
      sourceTurnId: 'turn-3',
      generatedAt: '2026-06-16T00:00:00.000Z',
    })

    const loaded = await store.load(paths, 'thread-1')
    expect(loaded).toMatchObject({
      threadId: 'thread-1',
      autoGenerate: true,
      what: 'Stabilize retries',
      why: 'Reduce payment failures',
      outOfScopeText: 'UI polish',
      sourceTurnId: 'turn-3',
    })
  })

  it('clears drafts by thread id', async () => {
    await store.save(paths, {
      threadId: 'thread-2',
      autoGenerate: false,
      what: '',
      why: '',
      outOfScopeText: '',
      touchedByUser: true,
      basedOnIntentVersion: 2,
    })

    await store.clear(paths, 'thread-2')
    await expect(store.load(paths, 'thread-2')).resolves.toBeNull()
  })
})
