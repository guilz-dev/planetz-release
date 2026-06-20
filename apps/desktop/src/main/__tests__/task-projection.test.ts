import type { AppState, TaskViewModel, UiState } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  resolveSelectedTaskId,
  sortTasksByCreatedAtDesc,
  syncCachedSelectedTaskId,
} from '../lib/projection/task-projection.js'

const task = (id: string, createdAt = '2026-05-27T00:00:00.000Z'): TaskViewModel =>
  ({
    id,
    title: id,
    status: 'pending',
    priority: 'normal',
    source: 'takt',
    createdAt,
    updatedAt: createdAt,
  }) as TaskViewModel

const baseState = (tasks: TaskViewModel[], selectedTaskId?: string): AppState =>
  ({
    tasks,
    selectedTaskId,
  }) as AppState

describe('sortTasksByCreatedAtDesc', () => {
  it('orders tasks by createdAt descending', () => {
    const sorted = sortTasksByCreatedAtDesc([
      task('older', '2026-05-27T08:00:00.000Z'),
      task('newer', '2026-05-27T10:00:00.000Z'),
      task('middle', '2026-05-27T09:00:00.000Z'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['newer', 'middle', 'older'])
  })
})

describe('resolveSelectedTaskId', () => {
  it('returns undefined when selection is cleared with empty string', () => {
    const uiState: UiState = { selectedTaskId: '' }
    expect(resolveSelectedTaskId([task('a')], uiState)).toBeUndefined()
  })

  it('returns the id when it exists in the task list', () => {
    const uiState: UiState = { selectedTaskId: 'a' }
    expect(resolveSelectedTaskId([task('a'), task('b')], uiState)).toBe('a')
  })

  it('returns undefined when the id is not in the task list', () => {
    const uiState: UiState = { selectedTaskId: 'missing' }
    expect(resolveSelectedTaskId([task('a')], uiState)).toBeUndefined()
  })
})

describe('syncCachedSelectedTaskId', () => {
  it('updates cached selection without a full refresh', () => {
    const cached = baseState([task('a'), task('b')], undefined)
    const uiState: UiState = { selectedTaskId: 'b' }
    expect(syncCachedSelectedTaskId(cached, uiState, cached.tasks).selectedTaskId).toBe('b')
  })

  it('resolves selection against fresh tasks when cache is stale', () => {
    const cached = baseState([task('a')], undefined)
    const freshTasks = [task('a'), task('b')]
    const uiState: UiState = { selectedTaskId: 'b' }
    expect(syncCachedSelectedTaskId(cached, uiState, freshTasks).selectedTaskId).toBe('b')
    expect(syncCachedSelectedTaskId(cached, uiState, freshTasks).tasks).toHaveLength(2)
  })
})
