import {
  allowedProviderIdsForSettingsEditor,
  allowedProviderIdsFromConfig,
  isOrbitProviderId,
  type OrbitProviderId,
  type SelectVisibleProviderIdsInput,
  type UiConfig,
  unavailableAllowedProviders,
} from '@planetz/shared'
import { useMemo } from 'react'
import { useExecutionOptionSources } from './use-execution-option-sources'

export interface ProviderCatalogSnapshot {
  configuredProviders: OrbitProviderId[]
  runtimeDetectedProviders: OrbitProviderId[]
  detectedProviders: OrbitProviderId[]
  loading: boolean
  loadError: string | null
  refresh: () => void
}

export function useProviderCatalogSnapshot(enabled = true): ProviderCatalogSnapshot {
  const executionOptions = useExecutionOptionSources({ enabled })
  return useMemo(() => {
    const configuredProviders = (executionOptions.catalog?.configuredProviders ?? []).filter(
      isOrbitProviderId,
    )
    const runtimeDetectedProviders = (
      executionOptions.catalog?.runtimeDetectedProviders ?? []
    ).filter(isOrbitProviderId)
    const detectedProviders = runtimeDetectedProviders
    return {
      configuredProviders,
      runtimeDetectedProviders,
      detectedProviders,
      loading: executionOptions.loading,
      loadError: executionOptions.loadError,
      refresh: executionOptions.refresh,
    }
  }, [
    executionOptions.catalog,
    executionOptions.loading,
    executionOptions.loadError,
    executionOptions.refresh,
  ])
}

export function useConfiguredProviders(enabled = true): OrbitProviderId[] {
  return useProviderCatalogSnapshot(enabled).configuredProviders
}

export function useRuntimeDetectedProviders(enabled = true): OrbitProviderId[] {
  return useProviderCatalogSnapshot(enabled).runtimeDetectedProviders
}

export function useDetectedProviders(enabled = true): OrbitProviderId[] {
  return useProviderCatalogSnapshot(enabled).detectedProviders
}

export function useAllowedProvidersFromConfig(config: UiConfig | null | undefined) {
  return useMemo(() => allowedProviderIdsFromConfig(config?.ui), [config])
}

export function useAllowedProvidersForSettingsEditor(
  config: UiConfig | null | undefined,
  visibility?: SelectVisibleProviderIdsInput,
) {
  return useMemo(
    () => allowedProviderIdsForSettingsEditor(config?.ui, visibility),
    [config, visibility],
  )
}

export function useUnavailableAllowedProviders(input: {
  allowedProviderIds: readonly string[]
  detectedProviderIds: readonly string[]
}): OrbitProviderId[] {
  return useMemo(
    () =>
      unavailableAllowedProviders({
        allowedProviderIds: input.allowedProviderIds,
        detectedProviderIds: input.detectedProviderIds,
      }),
    [input.allowedProviderIds, input.detectedProviderIds],
  )
}
