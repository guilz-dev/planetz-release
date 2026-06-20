import { describe, expect, it } from 'vitest'
import { uniqueTaskId } from '../task-id.js'

describe('uniqueTaskId', () => {
  it('deduplicates slug collisions', () => {
    const existing = new Set(['my-task'])
    expect(uniqueTaskId('My Task', existing)).toBe('my-task-2')
  })
})
