import type { AgentOverrides } from './agent-overrides-schema.js'
import type { EngineConfig, PersonaProviderEntry } from './engine-config-schema.js'
import { personaProviderEntry } from './persona-provider-entry.js'

export type AgentExecutionSource = 'project-override' | 'persona-override' | 'workspace-default'

export interface ResolvedAgentExecution {
  provider?: string
  model?: string
  source: AgentExecutionSource
}

function trimId(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t && t.length > 0 ? t : undefined
}

function entryProvider(entry: PersonaProviderEntry): string | undefined {
  if (typeof entry === 'string') return trimId(entry)
  return trimId(entry.provider)
}

function entryModel(entry: PersonaProviderEntry): string | undefined {
  if (typeof entry === 'string') return undefined
  return trimId(entry.model)
}

function resolveFromPersonaMap(
  role: string,
  map: Record<string, PersonaProviderEntry> | undefined,
  source: AgentExecutionSource,
): ResolvedAgentExecution | null {
  const entry = personaProviderEntry(map, role)
  if (!entry) return null
  const provider = entryProvider(entry)
  const model = entryModel(entry)
  if (!provider && !model) return null
  return { provider, model, source }
}

/** Resolve provider/model for a built-in agent role with fixed precedence. */
export function resolveAgentRoleExecution(
  role: string,
  engine: EngineConfig,
  overrides: AgentOverrides,
): ResolvedAgentExecution {
  const project = resolveFromPersonaMap(role, overrides.persona_providers, 'project-override')
  if (project) return project

  const persona = resolveFromPersonaMap(role, engine.persona_providers, 'persona-override')
  if (persona) return persona

  return {
    provider: trimId(engine.provider),
    model: trimId(engine.model),
    source: 'workspace-default',
  }
}
