import {
  isOrbitProviderId,
  ORBIT_PROVIDER_IDS,
  type OrbitProviderId,
} from './orbit-provider-catalog.js'
import {
  type SelectVisibleProviderIdsInput,
  selectVisibleProviderIds,
} from './provider-visibility.js'

/** Workspace-scoped provider allowlist stored under `ui.providerSelection`. */
export type UiProviderSelection = {
  allowedProviderIds: OrbitProviderId[]
}

function orderedOrbitIds(ids: Iterable<string>): OrbitProviderId[] {
  const set = new Set<OrbitProviderId>()
  for (const id of ids) {
    if (isOrbitProviderId(id)) set.add(id)
  }
  return ORBIT_PROVIDER_IDS.filter((id) => set.has(id))
}

/** Parse and sanitize `ui.providerSelection` from persisted config. */
export function normalizeProviderSelection(raw: unknown): UiProviderSelection | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const list = record.allowedProviderIds
  if (!Array.isArray(list)) return undefined
  const allowedProviderIds = orderedOrbitIds(list)
  if (allowedProviderIds.length === 0) return undefined
  return { allowedProviderIds }
}

/**
 * Allowed provider ids for selectors. When unset or empty, returns `undefined` so
 * callers show the full Orbit catalog (backward compatible).
 */
export function allowedProviderIdsFromConfig(
  ui: { providerSelection?: UiProviderSelection } | undefined | null,
): OrbitProviderId[] | undefined {
  const ids = ui?.providerSelection?.allowedProviderIds
  if (!ids || ids.length === 0) return undefined
  return ids
}

/** Provider ids checked in Settings when no allowlist is persisted yet. */
export function allowedProviderIdsForSettingsEditor(
  ui: { providerSelection?: UiProviderSelection } | undefined | null,
  visibility?: SelectVisibleProviderIdsInput,
): OrbitProviderId[] {
  const fromConfig = allowedProviderIdsFromConfig(ui)
  if (fromConfig) return fromConfig
  return selectVisibleProviderIds(visibility)
}

/** Providers allowed in UI but not detected as executable in this environment. */
export function unavailableAllowedProviders(input: {
  allowedProviderIds: readonly string[]
  detectedProviderIds: readonly string[]
}): OrbitProviderId[] {
  const detected = new Set(input.detectedProviderIds.filter(isOrbitProviderId))
  return orderedOrbitIds(
    input.allowedProviderIds.filter(
      (id): id is OrbitProviderId => isOrbitProviderId(id) && !detected.has(id),
    ),
  )
}

export function sanitizeAllowedProviderIds(ids: readonly string[]): OrbitProviderId[] {
  return orderedOrbitIds(ids)
}
