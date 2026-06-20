import type { DesktopCapabilitiesResult } from '@planetz/shared'
import { useEffect, useState } from 'react'

const DEFAULT_CAPABILITIES: DesktopCapabilitiesResult = {
  conversationModeEnabled: true,
  chatGateway: 'auto',
  devProvidersAvailable: false,
  chatAgentEnabled: true,
}

let capabilitiesPromise: Promise<DesktopCapabilitiesResult> | null = null

/** Shared fetch for desktop capabilities (dedupes concurrent IPC calls). */
export function fetchDesktopCapabilities(): Promise<DesktopCapabilitiesResult> {
  if (!capabilitiesPromise) {
    capabilitiesPromise = window.orbit.getDesktopCapabilities().catch((error: unknown) => {
      console.warn('Failed to fetch desktop capabilities.', error)
      return {
        conversationModeEnabled: true,
        chatGateway: 'auto',
        devProvidersAvailable: false,
        chatAgentEnabled: true,
      } satisfies DesktopCapabilitiesResult
    })
  }
  return capabilitiesPromise
}

/** @internal Resets cached capabilities for tests. */
export function resetDesktopCapabilitiesForTests(): void {
  capabilitiesPromise = null
}

export function useDesktopCapabilities(): DesktopCapabilitiesResult {
  const [capabilities, setCapabilities] = useState<DesktopCapabilitiesResult>(DEFAULT_CAPABILITIES)

  useEffect(() => {
    let cancelled = false
    void fetchDesktopCapabilities().then((result) => {
      if (!cancelled) setCapabilities(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return capabilities
}
