import {
  isOrbitProviderId,
  ORBIT_PROVIDER_IDS,
  type OrbitProviderId,
} from './orbit-provider-catalog.js'

/** Providers shown only in dev tooling (not end-user runtime selection). */
export const ORBIT_DEV_ONLY_PROVIDER_IDS = ['mock'] as const

export type OrbitDevOnlyProviderId = (typeof ORBIT_DEV_ONLY_PROVIDER_IDS)[number]

const DEV_ONLY_PROVIDER_SET = new Set<string>(ORBIT_DEV_ONLY_PROVIDER_IDS)

export function isDevOnlyProviderId(id: string | undefined): id is OrbitDevOnlyProviderId {
  const normalized = id?.trim()
  return normalized != null && normalized.length > 0 && DEV_ONLY_PROVIDER_SET.has(normalized)
}

export interface SelectVisibleProviderIdsInput {
  /** When true, dev-only providers appear in selectable lists. */
  includeDevProviders?: boolean
  /** Dev-only ids to keep visible for backward compatibility (saved allowlist, workspace config). */
  retainProviderIds?: readonly string[]
}

/** User-facing provider ids for scope checklists and default allowlists. */
export function selectVisibleProviderIds(
  input: SelectVisibleProviderIdsInput = {},
): OrbitProviderId[] {
  const retain = new Set(
    (input.retainProviderIds ?? []).filter(isOrbitProviderId).filter(isDevOnlyProviderId),
  )
  const includeDev = input.includeDevProviders === true
  return ORBIT_PROVIDER_IDS.filter((id) => {
    if (!isDevOnlyProviderId(id)) return true
    return includeDev || retain.has(id)
  })
}

export function collectRetainDevProviderIds(input: {
  allowedProviderIds?: readonly string[]
  configuredProviders?: readonly string[]
  currentProvider?: string
}): OrbitProviderId[] {
  const retain = new Set<OrbitProviderId>()
  for (const id of input.allowedProviderIds ?? []) {
    if (isOrbitProviderId(id) && isDevOnlyProviderId(id)) retain.add(id)
  }
  for (const id of input.configuredProviders ?? []) {
    if (isOrbitProviderId(id) && isDevOnlyProviderId(id)) retain.add(id)
  }
  const current = input.currentProvider?.trim()
  if (current && isOrbitProviderId(current) && isDevOnlyProviderId(current)) {
    retain.add(current)
  }
  return [...retain]
}
