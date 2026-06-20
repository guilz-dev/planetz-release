import { describe, expect, it } from 'vitest'
import { chainEdgeSchema } from '../schemas.js'

describe('chainEdgeSchema', () => {
  it('requires planned when toTaskId is omitted', () => {
    const result = chainEdgeSchema.safeParse({
      fromTaskId: 'a',
      status: 'waiting_for_dependency',
    })
    expect(result.success).toBe(false)
  })

  it('accepts pending edge with planned only', () => {
    const result = chainEdgeSchema.safeParse({
      fromTaskId: 'a',
      status: 'waiting_for_dependency',
      planned: { title: 'Next', mode: 'branch_handoff' },
    })
    expect(result.success).toBe(true)
  })

  it('requires mode when toTaskId is set', () => {
    const result = chainEdgeSchema.safeParse({
      fromTaskId: 'a',
      toTaskId: 'b',
      status: 'created',
    })
    expect(result.success).toBe(false)
  })
})
