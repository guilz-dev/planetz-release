import { describe, expect, it } from 'vitest'
import { mergeProviderModelCandidates } from '../model-candidate-merge.js'

describe('mergeProviderModelCandidates', () => {
  it('orders live above history above workspace above suggested above saved', () => {
    const merged = mergeProviderModelCandidates({
      live: [{ id: 'shared', label: 'Live' }],
      history: ['shared', 'history-only'],
      workspace: ['shared', 'workspace-only'],
      suggested: ['shared', 'suggested-only'],
      saved: ['shared', 'saved-only'],
    })

    expect(merged.map((item) => item.id)).toEqual([
      'shared',
      'history-only',
      'workspace-only',
      'suggested-only',
      'saved-only',
    ])
    expect(merged.find((item) => item.id === 'shared')?.source).toBe('live')
  })
})
