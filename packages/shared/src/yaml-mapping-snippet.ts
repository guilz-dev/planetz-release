import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

/** Serialize a value for a YAML snippet editor; empty/null yields blank textarea. */
export function valueToYamlText(value: unknown): string {
  if (value === undefined || value === null) return ''
  const text = stringifyYaml(value, { lineWidth: 0 }).trim()
  return text === '{}' || text === '[]' ? '' : text
}

/** Parse workflow-style advanced sections; blank input clears the section. */
export function parseYamlSection(text: string): unknown | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  return parseYaml(trimmed)
}

/** Parse engine-config passthrough; blank input yields an empty mapping. */
export function parseYamlMapping(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  if (!trimmed) return {}
  const parsed = parseYaml(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a YAML mapping at the root')
  }
  return parsed as Record<string, unknown>
}
