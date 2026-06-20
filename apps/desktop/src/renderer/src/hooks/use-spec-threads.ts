import type { SpecThreadSummary } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'

/** Loads Spec Thread summaries (conversation threads enriched with intent/ledger counts). */
export function useSpecThreads() {
  const [summaries, setSummaries] = useState<SpecThreadSummary[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (typeof window.orbit?.listSpecThreadSummaries !== 'function') return
    setLoading(true)
    try {
      const result = await window.orbit.listSpecThreadSummaries()
      setSummaries(result.summaries)
    } catch {
      // best-effort; keep last known summaries
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { summaries, loading, refresh }
}
