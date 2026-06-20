import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import { writeKvJson } from '../kv-store.js'
import {
  countMockTasks,
  listMockTaskRows,
  replaceAllMockTasks,
} from '../repositories/mock-tasks-repository.js'

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

describe('mock-tasks-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('replaces all mock tasks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mock-tasks-repo-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    replaceAllMockTasks(db, [SAMPLE_TASK])
    expect(countMockTasks(db)).toBe(1)

    replaceAllMockTasks(db, [])
    expect(countMockTasks(db)).toBe(0)
  })

  it('lists mock tasks ordered by created_at desc', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mock-tasks-order-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    replaceAllMockTasks(db, [
      { ...SAMPLE_TASK, id: 'older', createdAt: '2026-05-27T00:00:00.000Z' },
      { ...SAMPLE_TASK, id: 'newer', createdAt: '2026-05-27T01:00:00.000Z' },
    ])

    const rows = listMockTaskRows(db)
    expect(rows[0]?.id).toBe('newer')
    expect(rows[1]?.id).toBe('older')
  })
})

describe('mock queue initialized kv', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('tracks initialized flag separately from row count', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mock-queue-kv-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    writeKvJson(db, 'mock_queue.initialized', true)
    replaceAllMockTasks(db, [])

    expect(countMockTasks(db)).toBe(0)
  })
})
