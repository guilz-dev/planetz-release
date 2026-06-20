import { useCallback, useEffect, useState } from 'react'

/** Workspace-wide pending / unanchored counts for cross-thread Decisions links. */
export function useWorkspaceLedgerSummary() {
  const [pendingCount, setPendingCount] = useState(0)
  const [unanchoredCount, setUnanchoredCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const summary = await window.orbit.getIntentLedgerSummary({ window: 'all' })
      setPendingCount(summary.pendingCount)
      setUnanchoredCount(summary.unanchoredCount)
    } catch {
      setPendingCount(0)
      setUnanchoredCount(0)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { pendingCount, unanchoredCount, refresh }
}
