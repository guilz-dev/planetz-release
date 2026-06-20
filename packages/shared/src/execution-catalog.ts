import { parse as parseYaml } from 'yaml'
import type { EngineConfig } from './engine-config-schema.js'
import {
  type ExecutionEffortRef,
  type ExecutionProfileRef,
  extractExecutionEffortsFromDocument,
  extractExecutionEffortsFromEngineConfig,
  extractExecutionRefsFromDocument,
  extractExecutionRefsFromEngineConfig,
} from './execution-yaml-scan.js'
import { isOrbitProviderId } from './orbit-provider-catalog.js'
import {
  type SelectVisibleProviderIdsInput,
  selectVisibleProviderIds,
} from './provider-visibility.js'

export interface ExecutionCatalog {
  /** Provider ids configured in this workspace (valid Orbit ids and legacy aliases). */
  configuredProviders: string[]
  /** Provider ids detected from runtime environment (CLI/env/extensions). */
  runtimeDetectedProviders: string[]
  /** Model ids grouped by provider id from workspace YAML/config. */
  modelsByProvider: Record<string, string[]>
  /** Effort values grouped by provider id from workspace YAML/config. */
  effortsByProvider: Record<string, string[]>
}

function addToMap(
  map: Map<string, Set<string>>,
  provider: string | undefined,
  model: string | undefined,
): void {
  if (provider) {
    if (!map.has(provider)) map.set(provider, new Set())
    if (model) map.get(provider)?.add(model)
  } else if (model) {
    const unscoped = '_unscoped'
    if (!map.has(unscoped)) map.set(unscoped, new Set())
    map.get(unscoped)?.add(model)
  }
}

function ingestRefs(map: Map<string, Set<string>>, refs: ExecutionProfileRef[]): void {
  for (const ref of refs) {
    addToMap(map, ref.provider, ref.model)
  }
}

function ingestEfforts(map: Map<string, Set<string>>, refs: ExecutionEffortRef[]): void {
  for (const ref of refs) {
    if (!map.has(ref.provider)) map.set(ref.provider, new Set())
    map.get(ref.provider)?.add(ref.effort)
  }
}

function parseYamlRefs(yaml: string): ExecutionProfileRef[] {
  const trimmed = yaml.trim()
  if (!trimmed) return []
  try {
    const doc = parseYaml(trimmed)
    return extractExecutionRefsFromDocument(doc)
  } catch {
    return []
  }
}

function parseYamlEfforts(yaml: string): ExecutionEffortRef[] {
  const trimmed = yaml.trim()
  if (!trimmed) return []
  try {
    const doc = parseYaml(trimmed)
    return extractExecutionEffortsFromDocument(doc)
  } catch {
    return []
  }
}

export interface BuildExecutionCatalogInput {
  engineConfig?: EngineConfig | null
  workflowYamls?: readonly string[]
  taktConfigYaml?: string | null
}

/** Build a workspace execution catalog from engine config and workflow YAML bodies. */
export function buildExecutionCatalog(input: BuildExecutionCatalogInput): ExecutionCatalog {
  const modelMap = new Map<string, Set<string>>()
  const effortMap = new Map<string, Set<string>>()

  if (input.engineConfig) {
    ingestRefs(modelMap, extractExecutionRefsFromEngineConfig(input.engineConfig))
    ingestEfforts(effortMap, extractExecutionEffortsFromEngineConfig(input.engineConfig))
    const providerOptions = (input.engineConfig as Record<string, unknown>).provider_options
    if (providerOptions && typeof providerOptions === 'object' && !Array.isArray(providerOptions)) {
      for (const key of Object.keys(providerOptions as Record<string, unknown>)) {
        if (isOrbitProviderId(key)) addToMap(modelMap, key, undefined)
      }
    }
  }
  for (const yaml of input.workflowYamls ?? []) {
    ingestRefs(modelMap, parseYamlRefs(yaml))
    ingestEfforts(effortMap, parseYamlEfforts(yaml))
  }
  if (input.taktConfigYaml?.trim()) {
    ingestRefs(modelMap, parseYamlRefs(input.taktConfigYaml))
    ingestEfforts(effortMap, parseYamlEfforts(input.taktConfigYaml))
  }

  const configuredProviders = [...modelMap.keys()].filter((k) => k !== '_unscoped').sort()
  const modelsByProvider: Record<string, string[]> = {}
  for (const [provider, models] of modelMap) {
    if (provider === '_unscoped') continue
    modelsByProvider[provider] = [...models].sort()
  }

  const effortsByProvider: Record<string, string[]> = {}
  for (const [provider, efforts] of effortMap) {
    effortsByProvider[provider] = [...efforts].sort()
  }

  return { configuredProviders, runtimeDetectedProviders: [], modelsByProvider, effortsByProvider }
}

/** Providers selectable in UI: runtime detected → workspace configured → bundled Orbit ids. */
export function catalogProviderOptions(
  catalog: ExecutionCatalog | null | undefined,
  visibility?: SelectVisibleProviderIdsInput,
): string[] {
  const runtimeValid = (catalog?.runtimeDetectedProviders ?? []).filter(isOrbitProviderId)
  const configuredValid = (catalog?.configuredProviders ?? []).filter(isOrbitProviderId)
  const ordered: string[] = []
  for (const id of runtimeValid) {
    if (!ordered.includes(id)) ordered.push(id)
  }
  for (const id of configuredValid) {
    if (!ordered.includes(id)) ordered.push(id)
  }
  const bundled = selectVisibleProviderIds({
    includeDevProviders: visibility?.includeDevProviders,
    retainProviderIds: [...(visibility?.retainProviderIds ?? []), ...ordered],
  })
  for (const id of bundled) {
    if (!ordered.includes(id)) ordered.push(id)
  }
  return ordered
}

/** Models for a provider: workspace catalog first, then bundled hints. */
export function catalogModelOptions(
  provider: string | undefined,
  catalog: ExecutionCatalog | null | undefined,
  hintModels: readonly string[],
): string[] {
  const ids = new Set<string>()
  const key = provider?.trim()
  if (key) {
    for (const model of catalog?.modelsByProvider[key] ?? []) {
      ids.add(model)
    }
  }
  for (const hint of hintModels) {
    ids.add(hint)
  }
  return [...ids].sort()
}

/** Efforts for a provider from workspace catalog. */
export function catalogEffortOptions(
  provider: string | undefined,
  catalog: ExecutionCatalog | null | undefined,
  hintEfforts: readonly string[],
): string[] {
  const ids = new Set<string>()
  const key = provider?.trim()
  if (key) {
    for (const effort of catalog?.effortsByProvider[key] ?? []) {
      ids.add(effort)
    }
  }
  for (const hint of hintEfforts) {
    ids.add(hint)
  }
  return [...ids].sort()
}
