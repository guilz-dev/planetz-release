export interface ParsedCursorModel {
  id: string
  label?: string
}

export function isCursorModelId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

/** Parse `cursor-agent --list-models` stdout (e.g. `auto - Auto`). */
export function parseCursorListModelsOutput(text: string): ParsedCursorModel[] {
  const seen = new Set<string>()
  const results: ParsedCursorModel[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const dashIdx = trimmed.indexOf(' - ')
    if (dashIdx > 0) {
      const id = trimmed.slice(0, dashIdx).trim()
      const label = trimmed.slice(dashIdx + 3).trim()
      if (id && isCursorModelId(id) && !seen.has(id)) {
        seen.add(id)
        results.push({ id, ...(label ? { label } : {}) })
      }
      continue
    }

    // Keep backward compatibility for plain one-token output lines while
    // ignoring headers/help text such as "Available models" or "Tip: ...".
    if (isCursorModelId(trimmed) && !seen.has(trimmed)) {
      const id = trimmed
      seen.add(id)
      results.push({ id })
    }
  }

  return results
}
