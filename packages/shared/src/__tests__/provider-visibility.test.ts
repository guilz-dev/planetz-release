import { describe, expect, it } from 'vitest'
import { collectRetainDevProviderIds, selectVisibleProviderIds } from '../provider-visibility.js'

describe('provider-visibility', () => {
  it('hides dev-only providers by default', () => {
    expect(selectVisibleProviderIds()).not.toContain('mock')
  })

  it('shows dev-only providers when includeDevProviders is true', () => {
    expect(selectVisibleProviderIds({ includeDevProviders: true })).toContain('mock')
  })

  it('retains dev-only providers referenced by workspace config', () => {
    expect(
      selectVisibleProviderIds({
        retainProviderIds: ['mock'],
      }),
    ).toContain('mock')
  })

  it('collects retain ids from allowlist and current provider', () => {
    expect(
      collectRetainDevProviderIds({
        allowedProviderIds: ['cursor', 'mock'],
        configuredProviders: ['codex'],
        currentProvider: 'mock',
      }),
    ).toEqual(['mock'])
  })
})
