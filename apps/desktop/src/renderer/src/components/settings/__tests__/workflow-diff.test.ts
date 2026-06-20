import { describe, expect, it } from 'vitest'
import { diffLines } from '../workflow-diff.js'

describe('diffLines', () => {
  it('marks equal, added, and removed lines', () => {
    const result = diffLines('a\nb', 'a\nc')
    expect(result).toEqual([
      { kind: 'eq', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'c' },
    ])
  })
})
