/** First non-empty line from an error, or fallback (user-facing toast / banners). */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const firstLine = (error.message || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (firstLine) return firstLine
  }
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return fallback
}
