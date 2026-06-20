import type {
  ListProviderModelsResult,
  ModelFieldMode,
  ProviderModelCandidate,
} from '@planetz/shared'
import { resolveModelFieldMode, shouldRestrictModelToCandidates } from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchProviderModelsCached,
  invalidateProviderModelsCache,
  withSavedModelCandidate,
} from './provider-model-candidates-cache.js'

export interface UseProviderModelCandidatesOptions {
  provider: string
  currentModel?: string
  workflowName?: string
  enabled?: boolean
  /** Bust cache when upstream config (engine/workflow) changes. */
  reloadKey?: number | string
}

export interface ProviderModelCandidatesState {
  candidates: ProviderModelCandidate[]
  loading: boolean
  lastSelectedModel?: string
  liveError?: string
  stale?: boolean
  fetchedAt?: string
  /** Select when live listing succeeded; also while loading live-capable providers. */
  modelFieldMode: ModelFieldMode
  /** True only after live models loaded — use to hide manual-entry affordances. */
  modelSelectOnly: boolean
  refresh: () => void
  deleteHistoryItem: (model: string) => Promise<void>
}

export function useProviderModelCandidates(
  options: UseProviderModelCandidatesOptions,
): ProviderModelCandidatesState {
  const { provider, currentModel, workflowName, enabled = true, reloadKey } = options
  const [result, setResult] = useState<ListProviderModelsResult>({ models: [] })
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const refreshNextRef = useRef(false)
  const loadSeqRef = useRef(0)

  const load = useCallback(
    async (refresh: boolean) => {
      const trimmedProvider = provider.trim()
      if (!enabled || !trimmedProvider) {
        setResult({ models: [] })
        setLoading(false)
        return
      }
      const seq = ++loadSeqRef.current
      setResult({ models: [] })
      setLoading(true)
      try {
        const next = await fetchProviderModelsCached({
          provider: trimmedProvider,
          workflowName: workflowName?.trim() || undefined,
          refresh,
        })
        if (seq !== loadSeqRef.current) return
        setResult(next)
      } catch (error: unknown) {
        if (seq !== loadSeqRef.current) return
        console.warn('[useProviderModelCandidates] listProviderModels failed:', error)
        setResult({ models: [], liveError: 'Failed to load model candidates' })
      } finally {
        if (seq === loadSeqRef.current) setLoading(false)
      }
    },
    [provider, workflowName, enabled],
  )

  // reloadToken/reloadKey intentionally retriggers candidate loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: external refetch bump
  useEffect(() => {
    const refresh = refreshNextRef.current
    refreshNextRef.current = false
    void load(refresh)
  }, [load, reloadToken, reloadKey])

  const refresh = useCallback(() => {
    refreshNextRef.current = true
    setReloadToken((token) => token + 1)
  }, [])

  const deleteHistoryItem = useCallback(
    async (model: string) => {
      const trimmedProvider = provider.trim()
      const trimmedModel = model.trim()
      if (!trimmedProvider || !trimmedModel) return
      await window.orbit.deleteModelHistoryItem({ provider: trimmedProvider, model: trimmedModel })
      invalidateProviderModelsCache(trimmedProvider)
      setReloadToken((token) => token + 1)
    },
    [provider],
  )

  const candidates = useMemo(
    () => withSavedModelCandidate(result.models, currentModel),
    [result.models, currentModel],
  )

  const fieldState = {
    provider,
    fetchedAt: result.fetchedAt,
    liveError: result.liveError,
    loading,
    candidates,
  }

  const modelFieldMode = resolveModelFieldMode(fieldState)
  const modelSelectOnly = shouldRestrictModelToCandidates(fieldState)

  return {
    candidates,
    loading,
    lastSelectedModel: result.lastSelectedModel,
    liveError: result.liveError,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
    modelFieldMode,
    modelSelectOnly,
    refresh,
    deleteHistoryItem,
  }
}
