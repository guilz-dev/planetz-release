import { z } from 'zod'

export const lastSelectedModelByProviderSchema = z.record(z.string(), z.string().min(1))

export type LastSelectedModelByProvider = z.infer<typeof lastSelectedModelByProviderSchema>

function trimNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function normalizeLastSelectedModelByProvider(
  raw: unknown,
): LastSelectedModelByProvider | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const next: LastSelectedModelByProvider = {}
  for (const [provider, model] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof model !== 'string') continue
    const providerId = trimNonEmpty(provider)
    const modelId = trimNonEmpty(model)
    if (!providerId || !modelId) continue
    next[providerId] = modelId
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function readLastSelectedModelForProvider(
  state: { lastSelectedModelByProvider?: LastSelectedModelByProvider } | null | undefined,
  provider: string | undefined,
): string | undefined {
  const providerId = trimNonEmpty(provider)
  if (!providerId) return undefined
  return state?.lastSelectedModelByProvider?.[providerId]
}

export function writeLastSelectedModelByProvider(
  existing: LastSelectedModelByProvider | undefined,
  provider: string | undefined,
  model: string | undefined,
): LastSelectedModelByProvider | undefined {
  const providerId = trimNonEmpty(provider)
  const current = normalizeLastSelectedModelByProvider(existing)
  if (!providerId) return current

  const next = { ...(current ?? {}) }
  const modelId = trimNonEmpty(model)
  if (modelId) {
    next[providerId] = modelId
  } else {
    delete next[providerId]
  }

  return Object.keys(next).length > 0 ? next : undefined
}
