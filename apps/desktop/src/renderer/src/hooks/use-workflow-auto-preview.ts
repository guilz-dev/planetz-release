import type {
  AutoWorkflowDecision,
  LibraryAutoSuggestion,
  WorkflowAutoRoutePreviewResult,
} from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const AUTO_PREVIEW_DEBOUNCE_MS = 800
const AUTO_FULL_PREVIEW_CLOSE_SCORE_GAP = 0.12
const AUTO_FULL_PREVIEW_FAILURE_BACKOFF_MS = 5_000

export type WorkflowAutoPreviewPhase = 'deterministic' | 'full' | null

export type WorkflowAutoPreviewRationale = {
  decisionReason: string
  comparedDifferences: string[]
  fallbackApplied: boolean
  reasonCodes: string[]
}

export type WorkflowAutoPreviewState = {
  loading: boolean
  decision: AutoWorkflowDecision | null
  libraryAutoSuggestion: LibraryAutoSuggestion | null
  previewToken: string | null
  promptHash: string | null
  previewPhase: WorkflowAutoPreviewPhase
  previewRationale: WorkflowAutoPreviewRationale | null
  hasPrompt: boolean
  error: string | null
  requestFullPreview: () => Promise<WorkflowAutoRoutePreviewResult | null>
}

function buildRoutingPrompt(title?: string, body?: string): string {
  return [title, body]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .trim()
}

function buildPreviewRationale(
  result: WorkflowAutoRoutePreviewResult,
): WorkflowAutoPreviewRationale {
  return {
    decisionReason: result.audit?.decisionReason ?? '',
    comparedDifferences: result.audit?.comparedDifferences ?? [],
    fallbackApplied: result.decision.fallbackApplied,
    reasonCodes: result.decision.reasonCodes,
  }
}

function shouldAutoRequestFullPreview(result: WorkflowAutoRoutePreviewResult): boolean {
  if (result.decision.fallbackApplied) return false
  const highAmbiguity = result.audit?.taskRequirements.ambiguity === 'high'
  const hasStrictViableCandidate =
    result.audit?.candidatePool.some(
      (candidate) => !candidate.rejected && candidate.safetyTier === 'strict',
    ) ?? false
  const secondScore = result.decision.alternatives[0]?.score
  const closeMatch =
    typeof secondScore === 'number' &&
    result.decision.score - secondScore <= AUTO_FULL_PREVIEW_CLOSE_SCORE_GAP
  return highAmbiguity || hasStrictViableCandidate || closeMatch
}

export function useWorkflowAutoPreview(input: {
  enabled: boolean
  title?: string
  body?: string
  provider?: string
  model?: string
}): WorkflowAutoPreviewState {
  const [loading, setLoading] = useState(false)
  const [decision, setDecision] = useState<AutoWorkflowDecision | null>(null)
  const [libraryAutoSuggestion, setLibraryAutoSuggestion] = useState<LibraryAutoSuggestion | null>(
    null,
  )
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [promptHash, setPromptHash] = useState<string | null>(null)
  const [previewPhase, setPreviewPhase] = useState<WorkflowAutoPreviewPhase>(null)
  const [previewRationale, setPreviewRationale] = useState<WorkflowAutoPreviewRationale | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const autoFullFailureAtByPromptHash = useRef(new Map<string, number>())

  const hasPrompt = useMemo(
    () => buildRoutingPrompt(input.title, input.body).length > 0,
    [input.title, input.body],
  )

  useEffect(() => {
    if (!input.enabled) {
      setLoading(false)
      setDecision(null)
      setLibraryAutoSuggestion(null)
      setPreviewToken(null)
      setPromptHash(null)
      setPreviewPhase(null)
      setPreviewRationale(null)
      setError(null)
      autoFullFailureAtByPromptHash.current.clear()
      return
    }

    const prompt = buildRoutingPrompt(input.title, input.body)
    if (prompt.length === 0) {
      setLoading(false)
      setDecision(null)
      setLibraryAutoSuggestion(null)
      setPreviewToken(null)
      setPromptHash(null)
      setPreviewPhase(null)
      setPreviewRationale(null)
      setError(null)
      autoFullFailureAtByPromptHash.current.clear()
      return
    }

    const canRetryAutoFullForPromptHash = (nextPromptHash: string): boolean => {
      const failedAt = autoFullFailureAtByPromptHash.current.get(nextPromptHash)
      if (failedAt == null) return true
      return Date.now() - failedAt >= AUTO_FULL_PREVIEW_FAILURE_BACKOFF_MS
    }

    const runFullPreview = async (options: {
      auto: boolean
      expectedPromptHash?: string
    }): Promise<void> => {
      if (
        options.auto &&
        options.expectedPromptHash &&
        !canRetryAutoFullForPromptHash(options.expectedPromptHash)
      ) {
        setLoading(false)
        return
      }

      const fullRequest = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        const fullResult = await window.orbit.previewWorkflowAutoRoute({
          title: input.title,
          body: input.body,
          phase: 'full',
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
        })
        if (requestId.current !== fullRequest) return
        if (options.expectedPromptHash && fullResult.promptHash !== options.expectedPromptHash) {
          setLoading(false)
          return
        }
        if (options.expectedPromptHash) {
          autoFullFailureAtByPromptHash.current.delete(options.expectedPromptHash)
        }
        setDecision(fullResult.decision)
        setLibraryAutoSuggestion((current) => fullResult.libraryAutoSuggestion ?? current ?? null)
        setPreviewToken(fullResult.previewToken)
        setPromptHash(fullResult.promptHash)
        setPreviewPhase('full')
        setPreviewRationale(buildPreviewRationale(fullResult))
        setLoading(false)
      } catch (err: unknown) {
        if (requestId.current !== fullRequest) return
        if (options.expectedPromptHash) {
          autoFullFailureAtByPromptHash.current.set(options.expectedPromptHash, Date.now())
        }
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Preview failed')
      }
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      void window.orbit
        .previewWorkflowAutoRoute({
          title: input.title,
          body: input.body,
          phase: 'deterministic',
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
        })
        .then((result: WorkflowAutoRoutePreviewResult) => {
          if (requestId.current !== currentRequest) return
          setDecision(result.decision)
          setLibraryAutoSuggestion(result.libraryAutoSuggestion ?? null)
          setPreviewToken(result.previewToken)
          setPromptHash(result.promptHash)
          setPreviewPhase('deterministic')
          setPreviewRationale(null)
          if (shouldAutoRequestFullPreview(result)) {
            void runFullPreview({
              auto: true,
              expectedPromptHash: result.promptHash,
            })
            return
          }
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (requestId.current !== currentRequest) return
          setDecision(null)
          setLibraryAutoSuggestion(null)
          setPreviewToken(null)
          setPromptHash(null)
          setPreviewPhase(null)
          setPreviewRationale(null)
          setLoading(false)
          setError(err instanceof Error ? err.message : 'Preview failed')
        })
    }, AUTO_PREVIEW_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [input.enabled, input.title, input.body, input.provider, input.model])

  const requestFullPreview =
    useCallback(async (): Promise<WorkflowAutoRoutePreviewResult | null> => {
      const prompt = buildRoutingPrompt(input.title, input.body)
      if (!input.enabled || prompt.length === 0) return null

      const currentRequest = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        const result = await window.orbit.previewWorkflowAutoRoute({
          title: input.title,
          body: input.body,
          phase: 'full',
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
        })
        if (requestId.current !== currentRequest) return null
        setDecision(result.decision)
        setLibraryAutoSuggestion((current) => result.libraryAutoSuggestion ?? current ?? null)
        setPreviewToken(result.previewToken)
        setPromptHash(result.promptHash)
        setPreviewPhase('full')
        setPreviewRationale(buildPreviewRationale(result))
        setLoading(false)
        return result
      } catch (err: unknown) {
        if (requestId.current !== currentRequest) return null
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Preview failed')
        return null
      }
    }, [input.enabled, input.title, input.body, input.provider, input.model])

  return {
    loading,
    decision,
    libraryAutoSuggestion,
    previewToken,
    promptHash,
    previewPhase,
    previewRationale,
    hasPrompt,
    error,
    requestFullPreview,
  }
}
