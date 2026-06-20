import { describe, expect, it } from 'vitest'
import { isMockQueueMode } from '../lib/mock-queue-mode.js'

describe('isMockQueueMode', () => {
  it('returns true when PLANETZ_MOCK is enabled', () => {
    expect(
      isMockQueueMode({
        envMockEnabled: true,
        workspacePath: '/tmp/ws',
        bootstrapOverride: 'takt_ready',
      }),
    ).toBe(true)
  })

  it('returns true when no workspace is open', () => {
    expect(
      isMockQueueMode({
        envMockEnabled: false,
        workspacePath: null,
        bootstrapOverride: null,
      }),
    ).toBe(true)
  })

  it('returns true only for dev bootstrap override below takt_ready', () => {
    expect(
      isMockQueueMode({
        envMockEnabled: false,
        workspacePath: '/tmp/ws',
        bootstrapOverride: 'non_takt',
      }),
    ).toBe(true)
    expect(
      isMockQueueMode({
        envMockEnabled: false,
        workspacePath: '/tmp/ws',
        bootstrapOverride: 'takt_ready',
      }),
    ).toBe(false)
  })

  it('returns false for a normal open workspace without override', () => {
    expect(
      isMockQueueMode({
        envMockEnabled: false,
        workspacePath: '/tmp/ws',
        bootstrapOverride: null,
      }),
    ).toBe(false)
  })
})
