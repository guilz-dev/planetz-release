/** §7.1 — composite run identifier from run directory slug and session id. */
export function formatRunId(runDirSlug: string, sessionId: string): string {
  return `${runDirSlug}:${sessionId}`
}

export function parseRunId(runId: string): { runDirSlug: string; sessionId: string } | null {
  const idx = runId.indexOf(':')
  if (idx <= 0 || idx >= runId.length - 1) return null
  return {
    runDirSlug: runId.slice(0, idx),
    sessionId: runId.slice(idx + 1),
  }
}
