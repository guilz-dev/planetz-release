import { z } from 'zod'

/** Nested provider_options; validated loosely to preserve unknown keys. */
export const providerOptionsSchema = z.record(z.string(), z.unknown())

export const personaProviderEntrySchema = z.union([
  z.string().min(1),
  z
    .object({
      provider: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      provider_options: providerOptionsSchema.optional(),
    })
    .passthrough(),
])

export const rateLimitSwitchEntrySchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
})

export const engineConfigSchema = z
  .object({
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    concurrency: z.number().int().min(1).max(10).optional(),
    persona_providers: z.record(z.string(), personaProviderEntrySchema).optional(),
    rate_limit_fallback: z
      .object({
        switch_chain: z.array(rateLimitSwitchEntrySchema).optional(),
      })
      .optional(),
    provider_options: providerOptionsSchema.optional(),
  })
  .passthrough()

export type EngineConfig = z.infer<typeof engineConfigSchema>
export type PersonaProviderEntry = z.infer<typeof personaProviderEntrySchema>
export type RateLimitSwitchEntry = z.infer<typeof rateLimitSwitchEntrySchema>

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {}

export function parseEngineConfigYaml(raw: unknown): EngineConfig {
  const parsed = engineConfigSchema.safeParse(raw ?? {})
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  return parsed.data
}
