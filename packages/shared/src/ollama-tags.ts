export interface ParsedOllamaModel {
  id: string
  label?: string
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Parse `GET /api/tags` JSON into model candidates. */
export function parseOllamaTagsResponse(json: unknown): ParsedOllamaModel[] {
  const root = asObject(json)
  const models = root?.models
  if (!Array.isArray(models)) return []

  const out: ParsedOllamaModel[] = []
  for (const entry of models) {
    const row = asObject(entry)
    const name = typeof row?.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    const details = asObject(row?.details)
    const parameterSize =
      typeof details?.parameter_size === 'string' ? details.parameter_size.trim() : ''
    out.push({
      id: name,
      ...(parameterSize ? { label: parameterSize } : {}),
    })
  }
  return out
}
