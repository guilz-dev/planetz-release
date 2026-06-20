import type { PersonaProviderEntry } from './engine-config-schema.js'

export function personaProviderEntry(
  map: Record<string, PersonaProviderEntry> | undefined,
  personaKey: string,
): PersonaProviderEntry | undefined {
  const key = personaKey.trim()
  if (!key) return undefined
  return map?.[key]
}
