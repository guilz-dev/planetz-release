import { describe, expect, it } from 'vitest'
import { resolveEmptyLogMessage } from '../resolve-empty-log-message.js'

const t = (key: 'views.log.emptyNoRuns' | 'views.log.emptyFiltered') =>
  key === 'views.log.emptyNoRuns' ? 'no-runs' : 'filtered'

describe('resolveEmptyLogMessage', () => {
  it('uses emptyNoRuns when raw total is omitted and total is zero', () => {
    expect(resolveEmptyLogMessage(undefined, 0, t)).toBe('no-runs')
  })

  it('uses emptyFiltered when raw total is omitted but total is positive', () => {
    expect(resolveEmptyLogMessage(undefined, 1, t)).toBe('filtered')
  })

  it('uses emptyNoRuns when raw window count is zero', () => {
    expect(resolveEmptyLogMessage(0, 0, t)).toBe('no-runs')
  })

  it('uses emptyFiltered when events exist in window but filters exclude all', () => {
    expect(resolveEmptyLogMessage(3, 0, t)).toBe('filtered')
  })
})
