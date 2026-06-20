import {
  type EngineConfig,
  type ExecutionCatalog,
  type ExecutionProfileOverrides,
  extractWorkflowExecutionDefaults,
} from '@planetz/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return fallback
}

export interface ExecutionOptionSourcesState {
  engineConfig: EngineConfig | null
  catalog: ExecutionCatalog | null
  workflowDefaults: ExecutionProfileOverrides | undefined
  /** Loaded workflow YAML when `workflowName` or inline `workflowYaml` is set. */
  workflowYaml: string | undefined
  workflowDefaultsUnavailable: boolean
  loading: boolean
  /** Set when engine-config or catalog IPC failed (partial loads may still succeed). */
  loadError: string | null
  refresh: () => void
}

export interface UseExecutionOptionSourcesOptions {
  /** When set, workflow YAML defaults are merged into option sources. */
  workflowName?: string
  /** In-memory workflow YAML; preferred over `readWorkflow` when non-empty (e.g. unsaved drafts). */
  workflowYaml?: string
  /** Reload when this changes (e.g. after engine config save). */
  reloadKey?: number | string
  /** Skip loading when false (e.g. before workspace is selected). */
  enabled?: boolean
}

export function useExecutionOptionSources(
  options: UseExecutionOptionSourcesOptions = {},
): ExecutionOptionSourcesState {
  const { workflowName, workflowYaml, reloadKey, enabled = true } = options
  const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null)
  const [catalog, setCatalog] = useState<ExecutionCatalog | null>(null)
  const [workflowDefaults, setWorkflowDefaults] = useState<ExecutionProfileOverrides | undefined>(
    undefined,
  )
  const [loadedWorkflowYaml, setLoadedWorkflowYaml] = useState<string | undefined>(undefined)
  const [workflowDefaultsUnavailable, setWorkflowDefaultsUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setEngineConfig(null)
      setCatalog(null)
      setWorkflowDefaults(undefined)
      setLoadedWorkflowYaml(undefined)
      setWorkflowDefaultsUnavailable(false)
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const errors: string[] = []
    const [engineResult, catalogResult] = await Promise.allSettled([
      window.orbit.getEngineConfig(),
      window.orbit.listExecutionCatalog(),
    ])
    if (engineResult.status === 'fulfilled') {
      setEngineConfig(engineResult.value.config)
    } else {
      setEngineConfig(null)
      errors.push(toErrorMessage(engineResult.reason, 'Failed to load engine config'))
    }
    if (catalogResult.status === 'fulfilled') {
      setCatalog(catalogResult.value)
    } else {
      setCatalog(null)
      errors.push(toErrorMessage(catalogResult.reason, 'Failed to load execution catalog'))
    }
    setLoadError(errors.length > 0 ? errors.join('; ') : null)

    const inlineYaml = workflowYaml?.trim()
    if (inlineYaml) {
      setWorkflowDefaults(extractWorkflowExecutionDefaults(inlineYaml))
      setLoadedWorkflowYaml(inlineYaml)
      setWorkflowDefaultsUnavailable(false)
      setLoading(false)
      return
    }

    const name = workflowName?.trim()
    if (!name) {
      setWorkflowDefaults(undefined)
      setLoadedWorkflowYaml(undefined)
      setWorkflowDefaultsUnavailable(false)
      setLoading(false)
      return
    }

    try {
      const workflow = await window.orbit.readWorkflow({ nameOrPath: name })
      setWorkflowDefaults(extractWorkflowExecutionDefaults(workflow.yaml))
      setLoadedWorkflowYaml(workflow.yaml)
      setWorkflowDefaultsUnavailable(false)
    } catch (error: unknown) {
      console.warn('[useExecutionOptionSources] readWorkflow failed:', name, error)
      setWorkflowDefaults(undefined)
      setLoadedWorkflowYaml(undefined)
      setWorkflowDefaultsUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, workflowName, workflowYaml])

  // reloadKey intentionally retriggers option source loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: external refetch bump
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  return useMemo(
    () => ({
      engineConfig,
      catalog,
      workflowDefaults,
      workflowYaml: loadedWorkflowYaml,
      workflowDefaultsUnavailable,
      loading,
      loadError,
      refresh: () => {
        void load()
      },
    }),
    [
      engineConfig,
      catalog,
      workflowDefaults,
      loadedWorkflowYaml,
      workflowDefaultsUnavailable,
      loading,
      loadError,
      load,
    ],
  )
}
