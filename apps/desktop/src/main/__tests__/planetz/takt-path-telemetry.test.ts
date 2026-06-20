import { afterEach, describe, expect, it } from 'vitest'
import {
  clearTaktPathAccessLog,
  countTaktPathAccess,
  getTaktPathAccessLog,
  recordTaktPathAccess,
} from '../../planetz/takt-path-telemetry.js'

describe('takt-path-telemetry', () => {
  afterEach(() => {
    clearTaktPathAccessLog()
  })

  it('records path access events for audit', () => {
    recordTaktPathAccess('orbit_takt_global', '/ws/.orbit/takt-global', 'test')
    recordTaktPathAccess('home_dot_takt', '/Users/x/.takt', 'importGlobalTaktFromHome')

    expect(countTaktPathAccess('orbit_takt_global')).toBe(1)
    expect(countTaktPathAccess('home_dot_takt')).toBe(1)
    expect(getTaktPathAccessLog()).toHaveLength(2)
  })
})
