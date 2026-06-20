function summarizeParseError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'unknown parse error'
}

/** Parse JSON from sidecar storage; logs structured warning instead of failing silently. */
export function parseSidecarJson<T>(raw: string, label: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch (error: unknown) {
    console.warn(`[planetz][sidecar] Failed to parse ${label} JSON`, {
      error: summarizeParseError(error),
      bytes: raw.length,
      preview: raw.slice(0, 120),
    })
    return null
  }
}
