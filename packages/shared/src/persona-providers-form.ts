import {
  readEffortFromProviderOptions,
  writeEffortToProviderOptions,
} from './effort-provider-mapping.js'
import type { PersonaProviderEntry } from './engine-config-schema.js'

export type PersonaProviderRowMode = 'structured' | 'shorthand'

export interface PersonaStructuredDraft {
  provider: string
  model: string
  type: string
  effort: string
  providerOptions?: Record<string, unknown>
}

export interface PersonaProviderRow {
  persona: string
  mode: PersonaProviderRowMode
  shorthand: string
  provider: string
  model: string
  type: string
  effort: string
  /** Preserved provider_options (unknown keys survive round-trip). */
  providerOptions?: Record<string, unknown>
  /** Draft kept while editing in structured mode (restored on mode switch). */
  shorthandDraft?: string
  /** Draft kept while editing in shorthand mode (restored on mode switch). */
  structuredDraft?: PersonaStructuredDraft
}

function emptyStructuredDraft(): PersonaStructuredDraft {
  return { provider: '', model: '', type: '', effort: '' }
}

function rowFromShorthandEntry(persona: string, value: string): PersonaProviderRow {
  return {
    persona,
    mode: 'shorthand',
    shorthand: value,
    shorthandDraft: value,
    provider: '',
    model: '',
    type: '',
    effort: '',
    structuredDraft: emptyStructuredDraft(),
  }
}

function rowFromStructuredEntry(
  persona: string,
  entry: Exclude<PersonaProviderEntry, string>,
): PersonaProviderRow {
  const provider = entry.provider ?? ''
  const providerOptions = entry.provider_options as Record<string, unknown> | undefined
  const structured: PersonaStructuredDraft = {
    provider,
    model: entry.model ?? '',
    type: entry.type ?? '',
    effort: readEffortFromProviderOptions(provider, providerOptions) ?? '',
    ...(providerOptions ? { providerOptions: { ...providerOptions } } : {}),
  }
  return {
    persona,
    mode: 'structured',
    shorthand: '',
    shorthandDraft: '',
    provider: structured.provider,
    model: structured.model,
    type: structured.type,
    effort: structured.effort,
    ...(structured.providerOptions ? { providerOptions: structured.providerOptions } : {}),
    structuredDraft: structured,
  }
}

export function personaProvidersToRows(
  map: Record<string, PersonaProviderEntry> | undefined,
): PersonaProviderRow[] {
  if (!map) return []
  return Object.entries(map).map(([persona, entry]) => {
    if (typeof entry === 'string') {
      return rowFromShorthandEntry(persona, entry)
    }
    return rowFromStructuredEntry(persona, entry)
  })
}

export function rowsToPersonaProviders(
  rows: PersonaProviderRow[],
): Record<string, PersonaProviderEntry> | undefined {
  const out: Record<string, PersonaProviderEntry> = {}
  for (const row of rows) {
    const key = row.persona.trim()
    if (!key) continue
    if (row.mode === 'shorthand') {
      const value = row.shorthand.trim()
      if (value) out[key] = value
      continue
    }
    const provider = row.provider.trim() || undefined
    const model = row.model.trim() || undefined
    const type = row.type.trim() || undefined
    const provider_options = writeEffortToProviderOptions(provider, row.effort, row.providerOptions)
    if (!provider && !model && !type && !provider_options) continue
    out[key] = {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(type ? { type } : {}),
      ...(provider_options ? { provider_options } : {}),
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Persona keys that appear more than once among non-empty trimmed names. */
export function findDuplicatePersonaKeys(rows: PersonaProviderRow[]): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = row.persona.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key)
}
