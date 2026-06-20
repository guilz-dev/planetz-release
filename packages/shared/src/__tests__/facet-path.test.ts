import { describe, expect, it } from 'vitest'
import { suggestFacetDuplicateKey } from '../facet-path.js'

describe('suggestFacetDuplicateKey', () => {
  it('appends -copy when unused', () => {
    expect(suggestFacetDuplicateKey('planner', new Set())).toBe('planner-copy')
  })

  it('increments suffix until unique', () => {
    const existing = new Set(['planner-copy', 'planner-copy-2'])
    expect(suggestFacetDuplicateKey('planner', existing)).toBe('planner-copy-3')
  })
})
