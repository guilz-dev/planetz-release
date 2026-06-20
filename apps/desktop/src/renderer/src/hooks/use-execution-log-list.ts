import type { ExecutionLogQuery, ExecutionLogRecord } from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getExecutionAnalyticsBridgeGap } from '../lib/orbit-bridge-guard'
import { useAppStore } from '../store/app-store'
import { useStaleRequestGuard } from './use-stale-request-guard'

type ListMode = 'replace' | 'append'

interface UseExecutionLogListOptions {
  buildQuery: (cursor?: string) => ExecutionLogQuery
  queryDeps: ReadonlyArray<unknown>
  debounceMs?: number
}

function emptyListState(): {
  records: ExecutionLogRecord[]
  total: number
  rawTotalInWindow: number | undefined
  truncated: boolean
  hasMore: boolean
  nextCursor: string | undefined
} {
  return {
    records: [],
    total: 0,
    rawTotalInWindow: undefined,
    truncated: false,
    hasMore: false,
    nextCursor: undefined,
  }
}

export function useExecutionLogList({
  buildQuery,
  queryDeps,
  debounceMs = 200,
}: UseExecutionLogListOptions) {
  const stateRevision = useAppStore((s) => s.stateRevision)
  const [records, setRecords] = useState<ExecutionLogRecord[]>([])
  const [total, setTotal] = useState(0)
  const [rawTotalInWindow, setRawTotalInWindow] = useState<number | undefined>(undefined)
  const [truncated, setTruncated] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const captureRequestGeneration = useStaleRequestGuard([...queryDeps, stateRevision])

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof window.orbit.listExecutionLog>>, mode: ListMode) => {
      setRecords((prev) => (mode === 'append' ? [...prev, ...result.records] : result.records))
      setTotal(result.total)
      setRawTotalInWindow(result.rawTotalInWindow)
      setTruncated(result.truncated)
      setHasMore(result.hasMore ?? result.truncated)
      setNextCursor(result.nextCursor)
    },
    [],
  )

  const resetListState = useCallback(() => {
    const cleared = emptyListState()
    setRecords(cleared.records)
    setTotal(cleared.total)
    setRawTotalInWindow(cleared.rawTotalInWindow)
    setTruncated(cleared.truncated)
    setHasMore(cleared.hasMore)
    setNextCursor(cleared.nextCursor)
  }, [])

  const load = useCallback(async () => {
    if (getExecutionAnalyticsBridgeGap().length > 0) return
    const isCurrent = captureRequestGeneration()
    setLoading(true)
    setError(null)
    resetListState()
    try {
      const result = await window.orbit.listExecutionLog(buildQuery())
      if (!isCurrent()) return
      applyResult(result, 'replace')
    } catch (err) {
      if (!isCurrent()) return
      setError(err instanceof Error ? err.message : String(err))
      resetListState()
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [buildQuery, captureRequestGeneration, applyResult, resetListState])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return
    if (getExecutionAnalyticsBridgeGap().length > 0) return
    const isCurrent = captureRequestGeneration()
    setLoadingMore(true)
    setError(null)
    try {
      const result = await window.orbit.listExecutionLog(buildQuery(nextCursor))
      if (!isCurrent()) return
      applyResult(result, 'append')
    } catch (err) {
      if (!isCurrent()) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (isCurrent()) setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, loading, buildQuery, applyResult, captureRequestGeneration])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      void load()
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load, debounceMs])

  return {
    records,
    total,
    rawTotalInWindow,
    truncated,
    hasMore,
    nextCursor,
    loading,
    loadingMore,
    error,
    loadMore,
  }
}
