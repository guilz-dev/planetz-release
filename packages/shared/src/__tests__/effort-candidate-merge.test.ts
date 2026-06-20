import { describe, expect, it } from 'vitest'
import { mergeProviderEffortCandidates } from '../effort-candidate-merge.js'

describe('mergeProviderEffortCandidates', () => {
  it('dedupes by id keeping highest-priority source', () => {
    const merged = mergeProviderEffortCandidates({
      history: ['medium'],
      workspace: ['medium', 'high'],
      suggested: ['low', 'medium'],
      saved: ['custom'],
    })
    expect(merged.find((c) => c.id === 'medium')?.source).toBe('history')
    expect(merged.find((c) => c.id === 'high')?.source).toBe('workspace')
    expect(merged.find((c) => c.id === 'low')?.source).toBe('suggested')
    expect(merged.find((c) => c.id === 'custom')?.source).toBe('saved')
  })
})
