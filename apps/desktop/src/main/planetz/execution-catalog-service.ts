import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildExecutionCatalog,
  type EngineConfig,
  type ExecutionCatalog,
  isOrbitProviderId,
  type UiConfig,
} from '@planetz/shared'
import { fetchCopilotLiveModels } from './copilot-model-discovery.js'
import { fetchCursorLiveModels } from './cursor-model-discovery.js'
import { getDefaultLocalLlmService } from './local-llm/local-llm-service.js'
import { detectRuntimeProviderIds } from './provider-runtime-detection.js'
import { readTaktProjectConfig } from './takt-import-sources.js'

async function readYamlFilesInDir(dir: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const name of names.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
    try {
      out.push(await readFile(join(dir, name), 'utf8'))
    } catch {
      // skip unreadable
    }
  }
  return out
}

async function enrichCatalogWithLiveCursor(catalog: ExecutionCatalog): Promise<ExecutionCatalog> {
  const live = await fetchCursorLiveModels()
  if (live.error) return catalog

  const modelsByProvider = { ...catalog.modelsByProvider }
  if (live.models.length > 0) {
    const ids = new Set(modelsByProvider.cursor ?? [])
    for (const model of live.models) {
      ids.add(model.id)
    }
    modelsByProvider.cursor = [...ids].sort()
  }

  return {
    ...catalog,
    modelsByProvider,
  }
}

async function enrichCatalogWithLiveCopilot(catalog: ExecutionCatalog): Promise<ExecutionCatalog> {
  const live = await fetchCopilotLiveModels()
  if (live.error) return catalog

  const modelsByProvider = { ...catalog.modelsByProvider }
  if (live.models.length > 0) {
    const ids = new Set(modelsByProvider.copilot ?? [])
    for (const model of live.models) {
      ids.add(model.id)
    }
    modelsByProvider.copilot = [...ids].sort()
  }

  return {
    ...catalog,
    modelsByProvider,
  }
}

async function enrichCatalogWithLiveOllama(
  catalog: ExecutionCatalog,
  engineConfig: EngineConfig,
): Promise<ExecutionCatalog> {
  const localLlmService = getDefaultLocalLlmService()
  const ollamaAdapter = localLlmService.getAdapter('ollama')
  if (!ollamaAdapter) {
    return catalog
  }
  const live = await localLlmService.listLiveModels(ollamaAdapter.id, engineConfig, true)
  if (live.error) return catalog

  const modelsByProvider = { ...catalog.modelsByProvider }
  if (live.models.length > 0) {
    const ids = new Set(modelsByProvider.ollama ?? [])
    for (const model of live.models) {
      ids.add(model.id)
    }
    modelsByProvider.ollama = [...ids].sort()
  }

  return {
    ...catalog,
    modelsByProvider,
  }
}

function mergeRuntimeDetectedProviderIds(
  current: readonly string[],
  next: readonly string[],
): string[] {
  const detected = new Set(current)
  for (const id of next) {
    detected.add(id)
  }
  return [...detected].filter(isOrbitProviderId).sort((a, b) => a.localeCompare(b))
}

function withRuntimeDetectedProviders(
  catalog: ExecutionCatalog,
  providerIds: readonly string[],
): ExecutionCatalog {
  if (providerIds.length === 0) return catalog
  const runtimeDetectedProviders = mergeRuntimeDetectedProviderIds(
    catalog.runtimeDetectedProviders,
    providerIds,
  )
  return {
    ...catalog,
    runtimeDetectedProviders,
  }
}

export async function loadWorkspaceExecutionCatalog(input: {
  engineConfig: EngineConfig
  planetzWorkflowsDir: string
  workspacePath: string
  config: UiConfig
}): Promise<ExecutionCatalog> {
  const workflowYamls = await readYamlFilesInDir(input.planetzWorkflowsDir)
  const taktConfigYaml = await readTaktProjectConfig(input.workspacePath, input.config)
  const base = buildExecutionCatalog({
    engineConfig: input.engineConfig,
    workflowYamls,
    taktConfigYaml,
  })
  const withCursor = await enrichCatalogWithLiveCursor(base)
  const withCopilot = await enrichCatalogWithLiveCopilot(withCursor)
  const withOllama = await enrichCatalogWithLiveOllama(withCopilot, input.engineConfig)
  const runtimeProviders = await detectRuntimeProviderIds()
  return withRuntimeDetectedProviders(withOllama, runtimeProviders)
}
