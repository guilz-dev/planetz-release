import type { EngineConfig, PersonaProviderEntry } from './engine-config-schema.js'
import type { ExecutionCatalog } from './execution-catalog.js'
import { catalogModelOptions, catalogProviderOptions } from './execution-catalog.js'
import type { ExecutionProfileOverrides } from './execution-profile.js'
import {
  isOrbitProviderId,
  modelHintsForOrbitProvider,
  ORBIT_MODEL_HINTS,
} from './orbit-provider-catalog.js'

export {
  isOrbitProviderId,
  ORBIT_MODEL_HINTS,
  ORBIT_PROVIDER_IDS,
  type OrbitProviderId,
} from './orbit-provider-catalog.js'

function trimId(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t && t.length > 0 ? t : undefined
}

function addProvider(target: Set<string>, value: string | undefined): void {
  const id = trimId(value)
  if (id) target.add(id)
}

function addModel(target: Set<string>, value: string | undefined): void {
  const id = trimId(value)
  if (id) target.add(id)
}

function personaEntryProvider(entry: PersonaProviderEntry): string | undefined {
  if (typeof entry === 'string') return trimId(entry)
  return trimId(entry.provider)
}

function personaEntryModel(entry: PersonaProviderEntry): string | undefined {
  if (typeof entry === 'string') return undefined
  return trimId(entry.model)
}

function modelHintsForProvider(provider: string | undefined): readonly string[] {
  return modelHintsForOrbitProvider(provider)
}

export interface ExecutionOverrideOptionSources {
  engineConfig?: EngineConfig | null
  workflowDefaults?: ExecutionProfileOverrides
  /** Workspace-scanned provider/model catalog (from IPC). */
  catalog?: ExecutionCatalog | null
  currentProvider?: string
  currentModel?: string
}

/** Sorted provider ids: Orbit catalog, workspace config, and current value. */
export function collectProviderOptions(sources: ExecutionOverrideOptionSources): string[] {
  const { engineConfig, workflowDefaults, currentProvider, catalog } = sources
  const ids = new Set<string>(catalogProviderOptions(catalog ?? null))

  addProvider(ids, engineConfig?.provider)
  addProvider(ids, workflowDefaults?.provider)
  addProvider(ids, currentProvider)

  for (const entry of Object.values(engineConfig?.persona_providers ?? {})) {
    const p = personaEntryProvider(entry)
    if (p && isOrbitProviderId(p)) addProvider(ids, p)
  }
  for (const entry of engineConfig?.rate_limit_fallback?.switch_chain ?? []) {
    addProvider(ids, entry.provider)
  }

  return [...ids].sort()
}

/** Sorted model ids from workspace catalog, config, and provider hints. */
export function collectModelOptions(sources: ExecutionOverrideOptionSources): string[] {
  const { engineConfig, workflowDefaults, currentModel, currentProvider, catalog } = sources
  const providerFilter = trimId(currentProvider)
  const hints = providerFilter ? modelHintsForProvider(providerFilter) : []
  const ids = new Set<string>(catalogModelOptions(providerFilter, catalog ?? null, hints))
  const engineProvider = trimId(engineConfig?.provider)
  const workflowProvider = trimId(workflowDefaults?.provider)

  if (!providerFilter || !engineProvider || engineProvider === providerFilter) {
    addModel(ids, engineConfig?.model)
  }
  if (!providerFilter || !workflowProvider || workflowProvider === providerFilter) {
    addModel(ids, workflowDefaults?.model)
  }
  addModel(ids, currentModel)

  for (const entry of Object.values(engineConfig?.persona_providers ?? {})) {
    const entryProvider = personaEntryProvider(entry)
    if (providerFilter && entryProvider && entryProvider !== providerFilter) continue
    addModel(ids, personaEntryModel(entry))
  }
  for (const entry of engineConfig?.rate_limit_fallback?.switch_chain ?? []) {
    const entryProvider = trimId(entry.provider)
    if (providerFilter && entryProvider && entryProvider !== providerFilter) continue
    addModel(ids, entry.model)
  }

  if (!providerFilter) {
    for (const hintList of Object.values(ORBIT_MODEL_HINTS)) {
      for (const hint of hintList ?? []) {
        ids.add(hint)
      }
    }
  }

  return [...ids].sort()
}

/** Whether `model` is a valid option for `currentProvider` (empty model is always allowed). */
export function isModelInOptionList(
  model: string,
  sources: ExecutionOverrideOptionSources & { currentProvider: string },
): boolean {
  const trimmed = model.trim()
  if (!trimmed) return true
  return collectModelOptions({
    engineConfig: sources.engineConfig,
    workflowDefaults: sources.workflowDefaults,
    currentProvider: sources.currentProvider,
  }).includes(trimmed)
}
