import {
  collectRetainDevProviderIds,
  isOrbitProviderId,
  type OrbitProviderId,
  selectVisibleProviderIds,
} from '@planetz/shared'
import { useEffect, useMemo, useState } from 'react'
import { fetchDesktopCapabilities } from './use-desktop-capabilities.js'

export interface UseVisibleProviderScopeInput {
  allowedProviderIds?: readonly string[]
  configuredProviders?: readonly string[]
  currentProvider?: string
}

export interface UseVisibleProviderScopeResult {
  devProvidersAvailable: boolean
  showDevProviders: boolean
  setShowDevProviders: (next: boolean) => void
  visibleProviderIds: OrbitProviderId[]
  retainDevProviderIds: OrbitProviderId[]
}

export function useVisibleProviderScope(
  input: UseVisibleProviderScopeInput,
): UseVisibleProviderScopeResult {
  const [devProvidersAvailable, setDevProvidersAvailable] = useState(false)
  const [showDevProviders, setShowDevProviders] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchDesktopCapabilities().then((capabilities) => {
      if (cancelled) return
      setDevProvidersAvailable(capabilities.devProvidersAvailable)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const retainDevProviderIds = useMemo(
    () =>
      collectRetainDevProviderIds({
        allowedProviderIds: input.allowedProviderIds,
        configuredProviders: input.configuredProviders,
        currentProvider: input.currentProvider,
      }),
    [input.allowedProviderIds, input.configuredProviders, input.currentProvider],
  )

  const visibleProviderIds = useMemo(
    () =>
      selectVisibleProviderIds({
        includeDevProviders: devProvidersAvailable && showDevProviders,
        retainProviderIds: retainDevProviderIds,
      }),
    [devProvidersAvailable, showDevProviders, retainDevProviderIds],
  )

  return {
    devProvidersAvailable,
    showDevProviders,
    setShowDevProviders,
    visibleProviderIds,
    retainDevProviderIds,
  }
}

export function filterAllowedToVisibleProviders(
  allowedProviderIds: readonly OrbitProviderId[],
  visibleProviderIds: readonly OrbitProviderId[],
): OrbitProviderId[] {
  const allowed = new Set(allowedProviderIds)
  return visibleProviderIds.filter((id) => allowed.has(id))
}

/** Provider allowlist for execution profile dropdowns (respects dev-only visibility). */
export function resolveAllowedProvidersForProfileFields(input: {
  allowedFromConfig?: readonly string[]
  visibleProviderIds: readonly OrbitProviderId[]
}): OrbitProviderId[] {
  const fromConfig = (input.allowedFromConfig ?? []).filter(isOrbitProviderId)
  if (fromConfig.length > 0) {
    return filterAllowedToVisibleProviders(fromConfig, input.visibleProviderIds)
  }
  return [...input.visibleProviderIds]
}
