export interface ParsedCodexModel {
  id: string
  label?: string
}

export function isCodexModelId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

/** Parse `codex debug models` JSON output (`models[].slug` / `models[].display_name`). */
export function parseCodexDebugModelsOutput(text: string): ParsedCodexModel[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  let decoded: unknown
  try {
    decoded = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!decoded || typeof decoded !== 'object') return []

  const models = (decoded as { models?: unknown }).models
  if (!Array.isArray(models)) return []

  const seen = new Set<string>()
  const results: ParsedCodexModel[] = []
  for (const entry of models) {
    if (!entry || typeof entry !== 'object') continue
    const visibility = (entry as { visibility?: unknown }).visibility
    if (typeof visibility === 'string' && visibility !== 'list') continue
    const slug = (entry as { slug?: unknown }).slug
    if (typeof slug !== 'string') continue
    const id = slug.trim()
    if (!isCodexModelId(id) || seen.has(id)) continue
    seen.add(id)

    const displayName = (entry as { display_name?: unknown }).display_name
    const label = typeof displayName === 'string' ? displayName.trim() : ''
    results.push(label ? { id, label } : { id })
  }
  return results
}
