function normalizeModelOptionToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Renders model options as `<id> — <label>` only when the display label adds
 * information beyond a cosmetic formatting difference.
 */
export function formatModelOptionLabel(id: string, label?: string): string {
  const trimmedId = id.trim()
  const trimmedLabel = label?.trim()
  if (!trimmedLabel) return trimmedId
  if (normalizeModelOptionToken(trimmedId) === normalizeModelOptionToken(trimmedLabel)) {
    return trimmedId
  }
  return `${trimmedId} — ${trimmedLabel}`
}
