import { describe, expect, it } from 'vitest'
import { mockQueueSchema } from '../schemas.js'

describe('mockQueueSchema', () => {
  it('round-trips a minimal task list', () => {
    const data = {
      tasks: [
        {
          id: 'my-task',
          title: 'My task',
          priority: 'normal' as const,
          status: 'pending' as const,
          source: 'user' as const,
          createdAt: '2026-05-23T00:00:00.000Z',
          updatedAt: '2026-05-23T00:00:00.000Z',
        },
      ],
    }
    expect(mockQueueSchema.parse(data).tasks).toHaveLength(1)
  })

  it('accepts stopped tasks', () => {
    const data = {
      tasks: [
        {
          id: 'stopped-task',
          title: 'Stopped task',
          priority: 'normal' as const,
          status: 'stopped' as const,
          source: 'user' as const,
          createdAt: '2026-05-23T00:00:00.000Z',
          updatedAt: '2026-05-23T00:00:00.000Z',
        },
      ],
    }
    expect(mockQueueSchema.parse(data).tasks[0]?.status).toBe('stopped')
  })
})
