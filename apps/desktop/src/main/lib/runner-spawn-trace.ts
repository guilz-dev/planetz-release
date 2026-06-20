/** When set, log headless runner spawns (binary, op, pid) for Dock / process proliferation diagnosis. */
export function isRunnerSpawnTraceEnabled(): boolean {
  const raw = process.env.PLANETZ_TRACE_RUNNER?.trim()
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return process.env.PLANETZ_TRACE_ENQUEUE === '1'
}

export function logRunnerSpawnTrace(
  channel: string,
  details: Record<string, string | number | undefined>,
): void {
  if (!isRunnerSpawnTraceEnabled()) return
  const parts = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
  console.info(`[planetz] ${channel} ${parts.join(' ')}`)
}
