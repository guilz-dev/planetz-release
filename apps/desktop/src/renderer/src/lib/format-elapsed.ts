/** Compact human-readable elapsed string (e.g. `12s`, `4m`, `2h`, `3d`). */
export function formatElapsed(ms: number): string {
  if (ms < 0) return 'now'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}d`
}
