import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopCapabilities, installOrbitMock } from '../../__tests__/orbit-mock.js'
import {
  filterAllowedToVisibleProviders,
  resolveAllowedProvidersForProfileFields,
  useVisibleProviderScope,
} from '../use-visible-provider-scope.js'

describe('useVisibleProviderScope', () => {
  beforeEach(() => {
    installOrbitMock({
      getDesktopCapabilities: vi.fn(async () =>
        desktopCapabilities({ devProvidersAvailable: true }),
      ),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hides mock by default even in dev-capable environments', async () => {
    const { result } = renderHook(() =>
      useVisibleProviderScope({
        allowedProviderIds: ['cursor'],
        configuredProviders: ['codex'],
      }),
    )

    await waitFor(() => {
      expect(result.current.devProvidersAvailable).toBe(true)
    })
    expect(result.current.visibleProviderIds).not.toContain('mock')
  })

  it('shows mock when dev toggle is on', async () => {
    const { result } = renderHook(() => useVisibleProviderScope({}))

    await waitFor(() => {
      expect(result.current.devProvidersAvailable).toBe(true)
    })

    result.current.setShowDevProviders(true)

    await waitFor(() => {
      expect(result.current.visibleProviderIds).toContain('mock')
    })
  })

  it('retains mock when referenced by saved allowlist', async () => {
    const { result } = renderHook(() =>
      useVisibleProviderScope({
        allowedProviderIds: ['cursor', 'mock'],
      }),
    )

    await waitFor(() => {
      expect(result.current.visibleProviderIds).toContain('mock')
    })
  })
})

describe('filterAllowedToVisibleProviders', () => {
  it('preserves visible provider order', () => {
    expect(
      filterAllowedToVisibleProviders(['codex', 'cursor'], ['cursor', 'claude', 'codex']),
    ).toEqual(['cursor', 'codex'])
  })
})

describe('resolveAllowedProvidersForProfileFields', () => {
  it('uses visible ids when no allowlist is saved', () => {
    expect(
      resolveAllowedProvidersForProfileFields({
        visibleProviderIds: ['cursor', 'codex'],
      }),
    ).toEqual(['cursor', 'codex'])
  })

  it('intersects saved allowlist with visible ids', () => {
    expect(
      resolveAllowedProvidersForProfileFields({
        allowedFromConfig: ['mock', 'cursor'],
        visibleProviderIds: ['cursor', 'codex'],
      }),
    ).toEqual(['cursor'])
  })
})
