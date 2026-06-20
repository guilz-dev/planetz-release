import { useEffect, useState } from 'react'

/**
 * Returns `Date.now()` that re-renders the caller every `intervalMs` while
 * `enabled` is true. Used to live-update elapsed-time labels without spawning
 * a timer per row.
 */
export function useTickingNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])
  return now
}
