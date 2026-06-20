import { effortHintsForOrbitProvider } from './effort-suggested-values.js'

export type EffortProviderBucket = 'codex' | 'claude' | 'copilot'

export type EffortLeafKey = 'reasoning_effort' | 'effort'

const EFFORT_BUCKET_KEYS: readonly EffortProviderBucket[] = ['codex', 'claude', 'copilot']

function isEffortBucketKey(key: string): key is EffortProviderBucket {
  return (EFFORT_BUCKET_KEYS as readonly string[]).includes(key)
}

/** Providers that expose effort / reasoning_effort in provider_options. */
export function providerSupportsEffort(provider: string | undefined): boolean {
  return effortProviderBucket(provider) != null
}

export function effortProviderBucket(provider: string | undefined): EffortProviderBucket | null {
  const id = provider?.trim()
  if (!id) return null
  if (id === 'codex') return 'codex'
  if (id === 'copilot') return 'copilot'
  if (id === 'claude' || id === 'claude-sdk' || id === 'claude-terminal') return 'claude'
  return null
}

export function effortLeafKeyForBucket(bucket: EffortProviderBucket): EffortLeafKey {
  return bucket === 'codex' ? 'reasoning_effort' : 'effort'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function readLeaf(
  providerOptions: Record<string, unknown> | undefined,
  bucket: EffortProviderBucket,
): string | undefined {
  const branch = providerOptions?.[bucket]
  if (!isRecord(branch)) return undefined
  const key = effortLeafKeyForBucket(bucket)
  const raw = branch[key]
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Read normalized effort from provider_options for the given orbit provider id. */
export function readEffortFromProviderOptions(
  provider: string | undefined,
  providerOptions: unknown,
): string | undefined {
  const bucket = effortProviderBucket(provider)
  if (!bucket || !isRecord(providerOptions)) return undefined
  return readLeaf(providerOptions, bucket)
}

/**
 * Drop effort buckets (codex / claude / copilot) that do not match the current provider.
 * Non-bucket top-level keys are preserved.
 */
export function pruneStaleEffortBuckets(
  provider: string | undefined,
  providerOptions: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(providerOptions)) return undefined
  const activeBucket = effortProviderBucket(provider)
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(providerOptions)) {
    if (isEffortBucketKey(key)) {
      if (activeBucket && key === activeBucket) next[key] = value
      continue
    }
    next[key] = value
  }
  return Object.keys(next).length > 0 ? next : undefined
}

/** Merge normalized effort into provider_options without dropping unknown keys. */
export function writeEffortToProviderOptions(
  provider: string | undefined,
  effort: string | undefined,
  existing?: unknown,
): Record<string, unknown> | undefined {
  const bucket = effortProviderBucket(provider)
  const pruned = pruneStaleEffortBuckets(provider, existing)
  if (!bucket) return pruned

  const trimmed = effort?.trim()
  const leafKey = effortLeafKeyForBucket(bucket)
  const base = pruned ? { ...pruned } : {}
  const branch = isRecord(base[bucket]) ? { ...(base[bucket] as Record<string, unknown>) } : {}

  if (trimmed) {
    branch[leafKey] = trimmed
    base[bucket] = branch
  } else {
    delete branch[leafKey]
    if (Object.keys(branch).length > 0) {
      base[bucket] = branch
    } else {
      delete base[bucket]
    }
  }

  return Object.keys(base).length > 0 ? base : undefined
}

export function effortHelpText(provider: string | undefined): string | undefined {
  const bucket = effortProviderBucket(provider)
  if (!bucket) return undefined
  const leaf = effortLeafKeyForBucket(bucket)
  return `Saved as \`provider_options.${bucket}.${leaf}\``
}

/** Suggested values for provider (re-export for convenience). */
export function suggestedEffortsForProvider(provider: string | undefined): readonly string[] {
  return effortHintsForOrbitProvider(provider)
}
