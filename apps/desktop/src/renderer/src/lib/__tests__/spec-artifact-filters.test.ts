import type { TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { filterSpecArtifacts, pickLatestCompletedTaskId } from '../spec-artifact-filters.js'

function task(id: string, status: TaskViewModel['status'], updatedAt: string): TaskViewModel {
  return {
    id,
    title: id,
    status,
    priority: 'normal',
    source: 'takt',
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('spec-artifact-filters', () => {
  it('filters reports whose filenames hint at spec artifacts', () => {
    const filtered = filterSpecArtifacts([
      { fileName: 'README.md', relativePath: 'r/README.md', content: 'x' },
      { fileName: 'requirements.md', relativePath: 'r/requirements.md', content: 'req' },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.fileName).toBe('requirements.md')
  })

  it('picks the linked completed task with the latest updatedAt', () => {
    const tasks = [
      task('a', 'running', '2026-06-14T00:00:00.000Z'),
      task('b', 'completed', '2026-06-14T01:00:00.000Z'),
      task('c', 'completed', '2026-06-14T02:00:00.000Z'),
    ]
    expect(pickLatestCompletedTaskId(['a', 'b', 'c'], tasks)).toBe('c')
    expect(pickLatestCompletedTaskId(['c', 'b', 'a'], tasks)).toBe('c')
  })

  it('returns null when no completed tasks are linked', () => {
    expect(
      pickLatestCompletedTaskId(['a'], [task('a', 'running', '2026-06-14T00:00:00.000Z')]),
    ).toBeNull()
    expect(pickLatestCompletedTaskId([], [])).toBeNull()
  })
})
