import type { TaskViewModel } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { ModelHistoryTracker } from '../planetz/model-history-tracker.js'
import type { ModelHistoryStore } from '../sidecar/model-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

function task(id: string, status: TaskViewModel['status']): TaskViewModel {
  return {
    id,
    title: id,
    priority: 'normal',
    status,
    source: 'takt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('ModelHistoryTracker', () => {
  it('does not record history for tasks already completed on first observation', async () => {
    const upsert = vi.fn(async () => ({
      provider: 'cursor',
      model: 'auto',
      lastUsedAt: '',
      useCount: 1,
    }))
    const store = { upsert } as unknown as ModelHistoryStore
    const tracker = new ModelHistoryTracker(store)
    const paths = { root: '/tmp' } as SidecarPaths

    await tracker.onTasksUpdated(paths, [task('old-done', 'completed')])

    expect(upsert).not.toHaveBeenCalled()
  })

  it('records history when a tracked pending task completes', async () => {
    const upsert = vi.fn(async () => ({
      provider: 'cursor',
      model: 'auto',
      lastUsedAt: '',
      useCount: 1,
    }))
    const store = { upsert } as unknown as ModelHistoryStore
    const tracker = new ModelHistoryTracker(store)
    const paths = { root: '/tmp' } as SidecarPaths

    tracker.trackPendingTask('t1', { provider: 'cursor', model: 'auto' })
    await tracker.onTasksUpdated(paths, [task('t1', 'pending')])
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')])

    expect(upsert).toHaveBeenCalledWith(paths, { provider: 'cursor', model: 'auto' })
  })
})
