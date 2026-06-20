import type { ListProviderEffortsResult, ProviderEffortCandidate } from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchProviderEffortsCached,
  invalidateProviderEffortsCache,
} from './provider-effort-candidates-cache.js'

export interface UseProviderEffortCandidatesOptions {
  provider: string
  currentEffort?: string
  workflowName?: string
  reloadKey?: number | string
  enabled?: boolean
}

export interface ProviderEffortCandidatesState {
  candidates: ProviderEffortCandidate[]
  loading: boolean
  deleteHistoryItem: (effort: string) => Promise<void>
}

export function useProviderEffortCandidates(
  options: UseProviderEffortCandidatesOptions,
): ProviderEffortCandidatesState {
  const { provider, currentEffort, workflowName, enabled = true, reloadKey } = options
  const [result, setResult] = useState<ListProviderEffortsResult>({ efforts: [] })
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const loadSeqRef = useRef(0)

  const load = useCallback(async () => {
    const trimmedProvider = provider.trim()
    if (!enabled || !trimmedProvider) {
      setResult({ efforts: [] })
      return
    }
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const next = await fetchProviderEffortsCached({
        provider: trimmedProvider,
        currentEffort,
        workflowName: workflowName?.trim() || undefined,
      })
      if (seq !== loadSeqRef.current) return
      setResult(next)
    } catch (error: unknown) {
      if (seq !== loadSeqRef.current) return
      console.warn('[useProviderEffortCandidates] listProviderEfforts failed:', error)
      setResult({ efforts: [] })
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [provider, currentEffort, workflowName, enabled])

  // reloadKey / reloadToken intentionally bust cache when upstream config changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cache bust tokens
  useEffect(() => {
    void load()
  }, [load, reloadToken, reloadKey])

  const deleteHistoryItem = useCallback(
    async (effort: string) => {
      const trimmedProvider = provider.trim()
      const trimmedEffort = effort.trim()
      if (!trimmedProvider || !trimmedEffort) return
      await window.orbit.deleteEffortHistoryItem({
        provider: trimmedProvider,
        effort: trimmedEffort,
      })
      invalidateProviderEffortsCache(trimmedProvider)
      setReloadToken((token) => token + 1)
    },
    [provider],
  )

  return {
    candidates: result.efforts,
    loading,
    deleteHistoryItem,
  }
}
