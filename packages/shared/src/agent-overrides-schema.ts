import { z } from 'zod'
import { personaProviderEntrySchema } from './engine-config-schema.js'

export const agentOverridesSchema = z
  .object({
    persona_providers: z.record(z.string(), personaProviderEntrySchema).optional(),
  })
  .passthrough()

export type AgentOverrides = z.infer<typeof agentOverridesSchema>

export const DEFAULT_AGENT_OVERRIDES: AgentOverrides = {}

export function parseAgentOverridesYaml(raw: unknown): AgentOverrides {
  const parsed = agentOverridesSchema.safeParse(raw ?? {})
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  return parsed.data
}
