import type { EngineConfig } from './engine-config-schema.js'
import type { ExecutionProfileOverrides } from './execution-profile.js'

export interface ProviderScopedSavedModelsInput {
  provider: string
  currentModel?: string
  lastSelectedModel?: string
  engineConfig?: EngineConfig | null
  workflowDefaults?: ExecutionProfileOverrides
}

/** Saved-tier model ids that belong to the requested provider context. */
export function collectProviderScopedSavedModelIds(
  input: ProviderScopedSavedModelsInput,
): string[] {
  const provider = input.provider.trim()
  if (!provider) return []

  const ids: string[] = []
  const push = (id?: string) => {
    const trimmed = id?.trim()
    if (!trimmed || ids.includes(trimmed)) return
    ids.push(trimmed)
  }

  push(input.currentModel)
  push(input.lastSelectedModel)

  const engineProvider = input.engineConfig?.provider?.trim()
  if (engineProvider === provider) {
    push(input.engineConfig?.model)
  }

  const workflowProvider = input.workflowDefaults?.provider?.trim()
  if (workflowProvider === provider) {
    push(input.workflowDefaults?.model)
  }

  return ids
}
