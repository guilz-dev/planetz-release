import type { IntentLedgerEntry } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../store/app-store'
import { useStaleRequestGuard } from './use-stale-request-guard'

function buildPendingQuery(input: {
  expensiveOnly: boolean
  taskId: string | null
}): { expensiveOnly?: boolean; taskId?: string } | undefined {
  const query: { expensiveOnly?: boolean; taskId?: string } = {}
  if (input.expensiveOnly) query.expensiveOnly = true
  if (input.taskId) query.taskId = input.taskId
  return Object.keys(query).length > 0 ? query : undefined
}

export function useIntentLedgerQueue() {
  const expensiveOnly = useAppStore((s) => s.decisionsExpensiveOnly)
  const filterTaskId = useAppStore((s) => s.decisionsFilterTaskId)
  const stateRevision = useAppStore((s) => s.stateRevision)
  const [entries, setEntries] = useState<IntentLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captureRequestGeneration = useStaleRequestGuard([
    expensiveOnly,
    filterTaskId,
    stateRevision,
  ])

  const reload = useCallback(async () => {
    const isCurrent = captureRequestGeneration()
    setLoading(true)
    setError(null)
    try {
      const result = await window.orbit.listPendingIntentLedger(
        buildPendingQuery({ expensiveOnly, taskId: filterTaskId }),
      )
      if (!isCurrent()) return
      setEntries(result.entries)
    } catch (cause) {
      if (!isCurrent()) return
      setEntries([])
      setError(cause instanceof Error ? cause.message : 'Failed to load decisions')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [captureRequestGeneration, expensiveOnly, filterTaskId])

  useEffect(() => {
    void reload()
  }, [reload])

  const setExpensiveOnly = useAppStore((s) => s.setDecisionsExpensiveOnly)

  const clearFilter = useAppStore((s) => s.clearDecisionsFilter)

  return {
    entries,
    loading,
    error,
    reload,
    expensiveOnly,
    setExpensiveOnly,
    filterTaskId,
    clearFilter,
  }
}

export function usePendingDecisionCount(taskId?: string, options?: { enabled?: boolean }): number {
  const enabled = options?.enabled ?? true
  const expensiveOnly = useAppStore((s) => s.decisionsExpensiveOnly)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    let cancelled = false
    void window.orbit
      .countPendingIntentLedger(buildPendingQuery({ expensiveOnly, taskId: taskId ?? null }))
      .then((result) => {
        if (!cancelled) setCount(result.count)
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, expensiveOnly, taskId])

  return count
}
