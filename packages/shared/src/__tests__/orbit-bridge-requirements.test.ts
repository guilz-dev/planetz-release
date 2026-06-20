import { describe, expect, it } from 'vitest'
import type { OrbitBridge } from '../bridge-types.js'
import {
  CHAT_COMPOSER_STREAM_BRIDGE_METHODS,
  EXECUTION_ANALYTICS_BRIDGE_METHODS,
  missingOrbitMethods,
} from '../orbit-bridge-requirements.js'

describe('missingOrbitMethods', () => {
  it('returns all required names when orbit is undefined', () => {
    expect(missingOrbitMethods(undefined, EXECUTION_ANALYTICS_BRIDGE_METHODS)).toEqual([
      'listExecutionLog',
      'getExecutionSummary',
      'getIntentLedgerSummary',
    ])
  })

  it('returns only methods that are not functions', () => {
    const orbit = {
      listExecutionLog: async () => ({ records: [], total: 0, truncated: false }),
      getExecutionSummary: 'not-a-function',
    }
    expect(
      missingOrbitMethods(orbit as unknown as OrbitBridge, EXECUTION_ANALYTICS_BRIDGE_METHODS),
    ).toEqual(['getExecutionSummary', 'getIntentLedgerSummary'])
  })

  it('detects missing chat composer stream subscription', () => {
    expect(
      missingOrbitMethods({} as unknown as OrbitBridge, CHAT_COMPOSER_STREAM_BRIDGE_METHODS),
    ).toEqual(['onComposerSessionStream'])
  })

  it('returns empty when all required methods are functions', () => {
    const orbit = {
      listExecutionLog: async () => ({ records: [], total: 0, truncated: false }),
      getExecutionSummary: async () => ({
        window: '7d' as const,
        total: 0,
        completed: 0,
        failureCount: 0,
        successRate: 0,
        byStatus: [],
        byExecutor: [],
        byWorkflow: [],
      }),
      getIntentLedgerSummary: async () => ({
        window: '7d' as const,
        ingestedAssumedCount: 0,
        pendingCount: 0,
        ratifiedCount: 0,
        reversedCount: 0,
        adjudicationRate: null,
        scopeConflictCount: 0,
        unanchoredCount: 0,
        unanchoredRate: null,
        adjudicationLatencyP50Ms: null,
        ratifyRatio: null,
        reverseRatio: null,
        adoptCount: 0,
        fixCount: 0,
      }),
    }
    expect(
      missingOrbitMethods(orbit as unknown as OrbitBridge, EXECUTION_ANALYTICS_BRIDGE_METHODS),
    ).toEqual([])
  })
})
