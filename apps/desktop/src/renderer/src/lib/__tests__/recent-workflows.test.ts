import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_WORKFLOWS,
  parseStoredRecentWorkflowNames,
  pushRecentWorkflowNames,
} from '../recent-workflows.js'

describe('pushRecentWorkflowNames', () => {
  it('prepends a new workflow name', () => {
    expect(pushRecentWorkflowNames(['b', 'a'], 'c', MAX_RECENT_WORKFLOWS)).toEqual(['c', 'b', 'a'])
  })

  it('moves an existing name to the front without duplicates', () => {
    expect(pushRecentWorkflowNames(['c', 'b', 'a'], 'b', MAX_RECENT_WORKFLOWS)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('drops the oldest entry when exceeding max', () => {
    const current = ['e', 'd', 'c', 'b', 'a']
    expect(pushRecentWorkflowNames(current, 'f', MAX_RECENT_WORKFLOWS)).toEqual([
      'f',
      'e',
      'd',
      'c',
      'b',
    ])
  })

  it('ignores empty names', () => {
    expect(pushRecentWorkflowNames(['a'], '  ', MAX_RECENT_WORKFLOWS)).toEqual(['a'])
  })
})

describe('parseStoredRecentWorkflowNames', () => {
  it('trims, dedupes, and caps stored values', () => {
    expect(
      parseStoredRecentWorkflowNames(
        [' beta ', 'alpha', 'beta', 1, '', 'gamma', 'delta', 'epsilon', 'zeta'],
        5,
      ),
    ).toEqual(['beta', 'alpha', 'gamma', 'delta', 'epsilon'])
  })

  it('returns empty array for non-array input', () => {
    expect(parseStoredRecentWorkflowNames(null)).toEqual([])
    expect(parseStoredRecentWorkflowNames({})).toEqual([])
  })
})
