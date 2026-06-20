import {
  type EffortProviderBucket,
  effortLeafKeyForBucket,
  effortProviderBucket,
  readEffortFromProviderOptions,
} from './effort-provider-mapping.js'
import type {
  EngineConfig,
  PersonaProviderEntry,
  RateLimitSwitchEntry,
} from './engine-config-schema.js'

export interface ExecutionProfileRef {
  provider?: string
  model?: string
}

export interface ExecutionEffortRef {
  provider: string
  effort: string
}

function trimId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t.length > 0 ? t : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function addRef(
  target: ExecutionProfileRef[],
  provider: string | undefined,
  model: string | undefined,
): void {
  if (!provider && !model) return
  target.push({
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  })
}

function collectEffortsFromProviderOptions(
  providerOptions: unknown,
  target: ExecutionEffortRef[],
): void {
  if (!isRecord(providerOptions)) return
  for (const [branchKey, branchValue] of Object.entries(providerOptions)) {
    const bucket = effortProviderBucket(branchKey)
    if (!bucket || bucket !== branchKey) continue
    if (!isRecord(branchValue)) continue
    const leafKey = effortLeafKeyForBucket(bucket as EffortProviderBucket)
    const effort = trimId(branchValue[leafKey])
    if (effort) target.push({ provider: bucket, effort })
  }
}

function collectEffortsFromDocumentNode(
  node: Record<string, unknown>,
  target: ExecutionEffortRef[],
): void {
  collectEffortsFromProviderOptions(node.provider_options, target)

  const personaProviders = node.persona_providers
  if (
    personaProviders &&
    typeof personaProviders === 'object' &&
    !Array.isArray(personaProviders)
  ) {
    for (const entry of Object.values(personaProviders as Record<string, PersonaProviderEntry>)) {
      if (typeof entry === 'string') continue
      if (!isRecord(entry)) continue
      const provider = trimId(entry.provider)
      const effort = readEffortFromProviderOptions(provider, entry.provider_options)
      if (provider && effort) target.push({ provider, effort })
      collectEffortsFromProviderOptions(entry.provider_options, target)
    }
  }
}

function refsFromPersonaEntry(entry: PersonaProviderEntry): ExecutionProfileRef[] {
  if (typeof entry === 'string') {
    const shorthand = trimId(entry)
    return shorthand ? [{ provider: shorthand }] : []
  }
  const provider = trimId(entry.provider)
  const model = trimId(entry.model)
  if (!provider && !model) return []
  return [{ ...(provider ? { provider } : {}), ...(model ? { model } : {}) }]
}

function refsFromSwitchChain(chain: RateLimitSwitchEntry[] | undefined): ExecutionProfileRef[] {
  const out: ExecutionProfileRef[] = []
  for (const entry of chain ?? []) {
    addRef(out, trimId(entry.provider), trimId(entry.model))
  }
  return out
}

/** Collect provider/model pairs from a parsed workflow or config document. */
export function extractExecutionRefsFromDocument(doc: unknown): ExecutionProfileRef[] {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return []
  const root = doc as Record<string, unknown>
  const out: ExecutionProfileRef[] = []

  addRef(out, trimId(root.provider), trimId(root.model))

  const workflowConfig = root.workflow_config
  if (workflowConfig && typeof workflowConfig === 'object' && !Array.isArray(workflowConfig)) {
    const wc = workflowConfig as Record<string, unknown>
    addRef(out, trimId(wc.provider), trimId(wc.model))
  }

  const steps = root.steps
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue
      const s = step as Record<string, unknown>
      addRef(out, trimId(s.provider), trimId(s.model))
    }
  }

  const personaProviders = root.persona_providers
  if (
    personaProviders &&
    typeof personaProviders === 'object' &&
    !Array.isArray(personaProviders)
  ) {
    for (const entry of Object.values(personaProviders as Record<string, PersonaProviderEntry>)) {
      out.push(...refsFromPersonaEntry(entry))
    }
  }

  const rateLimit = root.rate_limit_fallback
  if (rateLimit && typeof rateLimit === 'object' && !Array.isArray(rateLimit)) {
    const chain = (rateLimit as { switch_chain?: RateLimitSwitchEntry[] }).switch_chain
    out.push(...refsFromSwitchChain(chain))
  }

  return out
}

/** Collect provider/effort pairs from provider_options in a parsed document. */
export function extractExecutionEffortsFromDocument(doc: unknown): ExecutionEffortRef[] {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return []
  const root = doc as Record<string, unknown>
  const out: ExecutionEffortRef[] = []

  collectEffortsFromDocumentNode(root, out)

  const workflowConfig = root.workflow_config
  if (workflowConfig && typeof workflowConfig === 'object' && !Array.isArray(workflowConfig)) {
    collectEffortsFromDocumentNode(workflowConfig as Record<string, unknown>, out)
  }

  const steps = root.steps
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue
      collectEffortsFromDocumentNode(step as Record<string, unknown>, out)
    }
  }

  return out
}

/** Collect refs from engine config (defaults, persona routes, fallback chain). */
export function extractExecutionRefsFromEngineConfig(config: EngineConfig): ExecutionProfileRef[] {
  const out: ExecutionProfileRef[] = []
  addRef(out, trimId(config.provider), trimId(config.model))
  for (const entry of Object.values(config.persona_providers ?? {})) {
    out.push(...refsFromPersonaEntry(entry))
  }
  out.push(...refsFromSwitchChain(config.rate_limit_fallback?.switch_chain))
  return out
}

/** Collect effort refs from engine config provider_options and persona entries. */
export function extractExecutionEffortsFromEngineConfig(
  config: EngineConfig,
): ExecutionEffortRef[] {
  const out: ExecutionEffortRef[] = []
  collectEffortsFromDocumentNode(config as Record<string, unknown>, out)
  return out
}
