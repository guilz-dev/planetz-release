import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODEL_HISTORY_MAX_ITEMS } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelHistoryStore } from '../sidecar/model-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

describe('ModelHistoryStore (sqlite)', () => {
  let dir: string
  let paths: SidecarPaths
  const store = new ModelHistoryStore()

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'model-history-store-'))
    paths = mockSidecarPaths(dir)
  })

  afterEach(async () => {
    closeAllSidecarSqlite()
    await rm(dir, { recursive: true, force: true })
  })

  it('upserts and increments useCount', async () => {
    await store.upsert(paths, { provider: 'cursor', model: 'auto' })
    await store.upsert(paths, { provider: 'cursor', model: 'auto' })
    const items = await store.list(paths)
    expect(items).toHaveLength(1)
    expect(items[0]?.useCount).toBe(2)
  })

  it('deletes a history item', async () => {
    await store.upsert(paths, { provider: 'cursor', model: 'auto' })
    await store.deleteItem(paths, { provider: 'cursor', model: 'auto' })
    expect(await store.list(paths)).toEqual([])
  })

  it('filters by provider', async () => {
    await store.upsert(paths, { provider: 'cursor', model: 'auto' })
    await store.upsert(paths, { provider: 'codex', model: 'gpt-5' })
    expect(await store.list(paths, 'cursor')).toEqual([
      expect.objectContaining({ provider: 'cursor', model: 'auto' }),
    ])
  })

  it('caps stored items at MODEL_HISTORY_MAX_ITEMS', async () => {
    for (let i = 0; i < MODEL_HISTORY_MAX_ITEMS + 5; i += 1) {
      await store.upsert(paths, { provider: 'cursor', model: `model-${i}` })
    }
    const items = await store.list(paths)
    expect(items).toHaveLength(MODEL_HISTORY_MAX_ITEMS)
  })
})
