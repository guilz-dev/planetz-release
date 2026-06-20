import { describe, expect, it } from 'vitest'
import {
  hasLiveModelCandidates,
  isLiveProviderModelsSuccess,
  providerSupportsLiveModelListing,
  resolveModelFieldMode,
  shouldRestrictModelToCandidates,
} from '../provider-live-models.js'

describe('providerSupportsLiveModelListing', () => {
  it('returns true for cursor, codex, ollama, and copilot', () => {
    expect(providerSupportsLiveModelListing('cursor')).toBe(true)
    expect(providerSupportsLiveModelListing('codex')).toBe(true)
    expect(providerSupportsLiveModelListing('ollama')).toBe(true)
    expect(providerSupportsLiveModelListing('copilot')).toBe(true)
    expect(providerSupportsLiveModelListing('claude')).toBe(false)
  })
})

describe('shouldRestrictModelToCandidates', () => {
  it('returns true when live models were fetched without error', () => {
    expect(
      shouldRestrictModelToCandidates({
        fetchedAt: '2026-05-31T00:00:00.000Z',
        loading: false,
        candidates: [{ id: 'gpt-4.1', source: 'live' }],
      }),
    ).toBe(true)
  })

  it('returns false while loading, on live error, or without live candidates', () => {
    expect(
      shouldRestrictModelToCandidates({
        fetchedAt: '2026-05-31T00:00:00.000Z',
        loading: true,
        candidates: [{ id: 'gpt-4.1', source: 'live' }],
      }),
    ).toBe(false)

    expect(
      shouldRestrictModelToCandidates({
        fetchedAt: '2026-05-31T00:00:00.000Z',
        liveError: 'Connection refused',
        loading: false,
        candidates: [{ id: 'gpt-4.1', source: 'history' }],
      }),
    ).toBe(false)

    expect(
      shouldRestrictModelToCandidates({
        fetchedAt: '2026-05-31T00:00:00.000Z',
        loading: false,
        candidates: [{ id: 'claude-3-5-sonnet', source: 'suggested' }],
      }),
    ).toBe(false)
  })
})

describe('resolveModelFieldMode', () => {
  it('uses select while loading live-capable providers', () => {
    expect(
      resolveModelFieldMode({
        provider: 'ollama',
        loading: true,
        candidates: [],
      }),
    ).toBe('select')
  })

  it('falls back to input for non-live providers and live errors', () => {
    expect(
      resolveModelFieldMode({
        provider: 'claude',
        loading: true,
        candidates: [],
      }),
    ).toBe('input')

    expect(
      resolveModelFieldMode({
        provider: 'ollama',
        fetchedAt: '2026-05-31T00:00:00.000Z',
        liveError: 'Connection refused',
        loading: false,
        candidates: [{ id: 'llama3.2:latest', source: 'suggested' }],
      }),
    ).toBe('input')
  })

  it('uses input when connected but live model list is empty', () => {
    expect(
      resolveModelFieldMode({
        provider: 'ollama',
        fetchedAt: '2026-05-31T00:00:00.000Z',
        loading: false,
        candidates: [{ id: 'llama3.2:latest', source: 'suggested' }],
      }),
    ).toBe('input')
    expect(isLiveProviderModelsSuccess({ fetchedAt: '2026-05-31T00:00:00.000Z' })).toBe(true)
    expect(hasLiveModelCandidates([])).toBe(false)
  })
})
