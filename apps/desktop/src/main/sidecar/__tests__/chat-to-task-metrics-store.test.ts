import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAT_TO_TASK_METRICS_KV_KEY } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, getSidecarSqlite } from '../../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../../storage/sqlite/kv-store.js'
import { ChatToTaskMetricsStore } from '../chat-to-task-metrics-store.js'

describe('ChatToTaskMetricsStore', () => {
  const roots: string[] = []
  let store: ChatToTaskMetricsStore
  let paths: ReturnType<typeof mockSidecarPaths>

  beforeEach(async () => {
    store = new ChatToTaskMetricsStore()
    const root = await mkdtemp(join(tmpdir(), 'chat-to-task-metrics-'))
    roots.push(root)
    paths = mockSidecarPaths(root)
  })

  afterEach(async () => {
    await closeAllSidecarSqlite()
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  })

  it('increments event counts and persists to kv_store', async () => {
    await store.record(paths, 'chat_add_to_task_click')
    await store.record(paths, 'chat_add_to_task_click')
    await store.record(paths, 'chat_to_task_conflict_replace')

    const metrics = await store.load(paths)
    expect(metrics.counts.chat_add_to_task_click).toBe(2)
    expect(metrics.counts.chat_to_task_conflict_replace).toBe(1)
    expect(metrics.updatedAt).toBeTruthy()

    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, CHAT_TO_TASK_METRICS_KV_KEY) as {
      counts: Record<string, number>
    }
    expect(raw.counts.chat_add_to_task_click).toBe(2)
  })

  it('drops unknown count keys when loading', async () => {
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, CHAT_TO_TASK_METRICS_KV_KEY, {
      counts: {
        chat_add_to_task_click: 1,
        legacy_unknown_event: 99,
      },
      updatedAt: '2026-06-01T00:00:00.000Z',
    })

    const metrics = await store.load(paths)
    expect(metrics.counts.chat_add_to_task_click).toBe(1)
    expect(metrics.counts).not.toHaveProperty('legacy_unknown_event')
  })
})
