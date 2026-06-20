import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MockQueueStore } from '../sidecar/mock-queue-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

const SAMPLE_TASK = {
  id: 'task-1',
  title: 'Sample',
  body: 'body',
  priority: 'normal' as const,
  status: 'pending' as const,
  source: 'user' as const,
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
}

describe('MockQueueStore (sqlite)', () => {
  let dir: string
  let paths: SidecarPaths
  const store = new MockQueueStore()

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mock-queue-store-'))
    paths = mockSidecarPaths(dir)
  })

  afterEach(async () => {
    closeAllSidecarSqlite()
    await rm(dir, { recursive: true, force: true })
  })

  it('returns null when mock queue was never persisted', async () => {
    expect(await store.load(paths)).toBeNull()
  })

  it('round-trips saved tasks', async () => {
    await store.save(paths, [SAMPLE_TASK])
    expect(await store.load(paths)).toEqual([SAMPLE_TASK])
  })

  it('replaces all tasks on save', async () => {
    await store.save(paths, [SAMPLE_TASK])
    await store.save(paths, [{ ...SAMPLE_TASK, id: 'task-2', title: 'Replaced' }])
    const loaded = await store.load(paths)
    expect(loaded).toHaveLength(1)
    expect(loaded?.[0]?.id).toBe('task-2')
  })

  it('returns newest tasks first by created_at desc', async () => {
    await store.save(paths, [
      { ...SAMPLE_TASK, id: 'older', createdAt: '2026-05-27T00:00:00.000Z' },
      { ...SAMPLE_TASK, id: 'newer', createdAt: '2026-05-27T01:00:00.000Z' },
    ])
    const loaded = await store.load(paths)
    expect(loaded?.[0]?.id).toBe('newer')
    expect(loaded?.[1]?.id).toBe('older')
  })

  it('returns empty array after saving an empty queue', async () => {
    await store.save(paths, [SAMPLE_TASK])
    await store.save(paths, [])
    expect(await store.load(paths)).toEqual([])
  })

  it('keeps empty queue after reopen without re-seeding defaults', async () => {
    await store.save(paths, [])
    closeAllSidecarSqlite()
    expect(await store.load(paths)).toEqual([])
  })
})
