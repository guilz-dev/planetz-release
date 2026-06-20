import { type CanonicalImportOffer, isEngineExecutionDefaultsConfigured } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'Failed to load engine config'
}

export interface ProviderModelSetupWizardState {
  /** Wizard should be visible (import resolved and defaults missing). */
  showWizard: boolean
  /** Still loading engine-config after import offer clears. */
  loading: boolean
  /** Non-null when engine-config could not be read; wizard stays closed so execution is not blocked. */
  loadError: string | null
  /** Call after a successful save so the wizard closes immediately. */
  markConfigured: () => void
  /** Re-read engine-config (e.g. after canonical import). */
  refresh: () => Promise<void>
}

export function useProviderModelSetupWizard(
  canonicalImportOffer: CanonicalImportOffer | null | undefined,
): ProviderModelSetupWizardState {
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (canonicalImportOffer) {
      setNeedsSetup(false)
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { config } = await window.orbit.getEngineConfig()
      setLoadError(null)
      setNeedsSetup(!isEngineExecutionDefaultsConfigured(config))
    } catch (error: unknown) {
      setLoadError(toErrorMessage(error))
      setNeedsSetup(false)
    } finally {
      setLoading(false)
    }
  }, [canonicalImportOffer])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const markConfigured = useCallback(() => {
    setNeedsSetup(false)
    setLoadError(null)
  }, [])

  return {
    showWizard: !canonicalImportOffer && !loading && needsSetup && loadError == null,
    loading,
    loadError,
    markConfigured,
    refresh,
  }
}
