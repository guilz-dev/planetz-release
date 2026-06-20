import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EFFORT_HISTORY_MAX_ITEMS } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EffortHistoryStore } from '../sidecar/effort-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

describe('EffortHistoryStore (sqlite)', () => {
  let dir: string
  let paths: SidecarPaths
  const store = new EffortHistoryStore()

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'effort-history-store-'))
    paths = mockSidecarPaths(dir)
  })

  afterEach(async () => {
    closeAllSidecarSqlite()
    await rm(dir, { recursive: true, force: true })
  })

  it('upserts and increments useCount', async () => {
    await store.upsert(paths, { provider: 'codex', effort: 'high' })
    await store.upsert(paths, { provider: 'codex', effort: 'high' })
    const items = await store.list(paths)
    expect(items).toHaveLength(1)
    expect(items[0]?.useCount).toBe(2)
  })

  it('deletes a history item', async () => {
    await store.upsert(paths, { provider: 'codex', effort: 'high' })
    await store.deleteItem(paths, { provider: 'codex', effort: 'high' })
    expect(await store.list(paths)).toEqual([])
  })

  it('filters by provider', async () => {
    await store.upsert(paths, { provider: 'codex', effort: 'high' })
    await store.upsert(paths, { provider: 'claude-sdk', effort: 'max' })
    expect(await store.list(paths, 'codex')).toEqual([
      expect.objectContaining({ provider: 'codex', effort: 'high' }),
    ])
  })

  it('caps stored items at EFFORT_HISTORY_MAX_ITEMS', async () => {
    for (let i = 0; i < EFFORT_HISTORY_MAX_ITEMS + 5; i += 1) {
      await store.upsert(paths, { provider: 'codex', effort: `level-${i}` })
    }
    const items = await store.list(paths)
    expect(items).toHaveLength(EFFORT_HISTORY_MAX_ITEMS)
  })
})
