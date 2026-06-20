import { describe, expect, it } from 'vitest'
import {
  allowedProviderIdsForSettingsEditor,
  allowedProviderIdsFromConfig,
  normalizeProviderSelection,
  sanitizeAllowedProviderIds,
  unavailableAllowedProviders,
} from '../provider-selection.js'
import { selectVisibleProviderIds } from '../provider-visibility.js'

describe('provider-selection', () => {
  it('normalizes and orders allowed provider ids', () => {
    expect(
      normalizeProviderSelection({
        allowedProviderIds: ['mock', 'cursor', 'invalid', 'cursor'],
      }),
    ).toEqual({ allowedProviderIds: ['cursor', 'mock'] })
  })

  it('returns undefined allowlist when config has no selection', () => {
    expect(allowedProviderIdsFromConfig(undefined)).toBeUndefined()
    expect(allowedProviderIdsFromConfig({})).toBeUndefined()
  })

  it('settings editor defaults to visible providers when unset', () => {
    expect(allowedProviderIdsForSettingsEditor(undefined)).toEqual(selectVisibleProviderIds())
    expect(allowedProviderIdsForSettingsEditor(undefined)).not.toContain('mock')
  })

  it('settings editor can include dev providers when requested', () => {
    expect(allowedProviderIdsForSettingsEditor(undefined, { includeDevProviders: true })).toContain(
      'mock',
    )
  })

  it('computes unavailable allowed providers', () => {
    expect(
      unavailableAllowedProviders({
        allowedProviderIds: ['cursor', 'copilot'],
        detectedProviderIds: ['cursor'],
      }),
    ).toEqual(['copilot'])
  })

  it('sanitizeAllowedProviderIds drops unknown ids', () => {
    expect(sanitizeAllowedProviderIds(['anthropic', 'codex'])).toEqual(['codex'])
  })
})
