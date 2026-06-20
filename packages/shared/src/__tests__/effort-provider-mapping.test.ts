import { describe, expect, it } from 'vitest'
import {
  pruneStaleEffortBuckets,
  readEffortFromProviderOptions,
  writeEffortToProviderOptions,
} from '../effort-provider-mapping.js'

describe('effort provider_options mapping', () => {
  it('maps codex to reasoning_effort', () => {
    const options = writeEffortToProviderOptions('codex', 'high', undefined)
    expect(options).toEqual({ codex: { reasoning_effort: 'high' } })
    expect(readEffortFromProviderOptions('codex', options)).toBe('high')
  })

  it('maps claude-sdk to claude.effort', () => {
    const options = writeEffortToProviderOptions('claude-sdk', 'max', undefined)
    expect(options).toEqual({ claude: { effort: 'max' } })
    expect(readEffortFromProviderOptions('claude-sdk', options)).toBe('max')
  })

  it('preserves unknown provider_options keys', () => {
    const existing = {
      codex: { reasoning_effort: 'low', custom_flag: true },
      other: { keep: 1 },
    }
    const options = writeEffortToProviderOptions('codex', 'medium', existing)
    expect(options?.codex).toEqual({ reasoning_effort: 'medium', custom_flag: true })
    expect(options?.other).toEqual({ keep: 1 })
  })

  it('clears leaf when effort is empty', () => {
    const existing = { copilot: { effort: 'high', extra: 'x' } }
    const options = writeEffortToProviderOptions('copilot', '', existing)
    expect(options).toEqual({ copilot: { extra: 'x' } })
  })

  it('pruneStaleEffortBuckets keeps only the active provider bucket', () => {
    const existing = {
      codex: { reasoning_effort: 'high' },
      claude: { effort: 'low' },
      other: { keep: true },
    }
    expect(pruneStaleEffortBuckets('claude-sdk', existing)).toEqual({
      claude: { effort: 'low' },
      other: { keep: true },
    })
  })

  it('writeEffortToProviderOptions drops stale buckets when provider changes', () => {
    const existing = {
      codex: { reasoning_effort: 'high', custom_flag: true },
      other: { keep: 1 },
    }
    const options = writeEffortToProviderOptions('claude-sdk', 'max', existing)
    expect(options).toEqual({
      claude: { effort: 'max' },
      other: { keep: 1 },
    })
  })

  it('writeEffortToProviderOptions drops all effort buckets when provider has no effort', () => {
    const existing = {
      codex: { reasoning_effort: 'high' },
      other: { keep: 1 },
    }
    expect(writeEffortToProviderOptions('cursor', '', existing)).toEqual({ other: { keep: 1 } })
  })
})
