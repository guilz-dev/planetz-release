import {
  type ComposerExecutionHint,
  evaluateComposerExecutionHint,
  type OllamaExecutionGuardPreviewResult,
  ollamaToolsGuardFromUi,
} from '@planetz/shared'
import { useEffect, useMemo, useState } from 'react'
import type { PromptComposerRunDraft } from '../lib/prompt-composer-run-draft.js'

export interface ComposerExecutionHintState {
  stepHint: ComposerExecutionHint | null
  ollamaGuard: OllamaExecutionGuardPreviewResult | null
  ollamaGuardLoading: boolean
}

export interface UseComposerExecutionHintInput {
  enabled: boolean
  /** Provider that will be used for enqueue / run now (form field). */
  taskProvider: string
  workflowYaml: string | undefined
  workflowName: string
  autoMode: boolean
  /** Minimal draft for Ollama guard preview IPC. */
  guardDraft: PromptComposerRunDraft | null
  recentWorkflowNames: string[]
}

function bridgeInputFromDraft(draft: PromptComposerRunDraft, recentWorkflowNames: string[]) {
  return {
    title: 'preview',
    body: draft.body,
    workflowMode: draft.workflowMode,
    ...(draft.workflowMode === 'manual' && draft.workflow ? { workflow: draft.workflow } : {}),
    recentWorkflowNames,
    ...(draft.provider ? { provider: draft.provider } : {}),
    ...(draft.model ? { model: draft.model } : {}),
  }
}

export function useComposerExecutionHint(
  input: UseComposerExecutionHintInput,
): ComposerExecutionHintState {
  const {
    enabled,
    taskProvider,
    workflowYaml,
    workflowName,
    autoMode,
    guardDraft,
    recentWorkflowNames,
  } = input

  const stepHint = useMemo(() => {
    if (!enabled || autoMode) return null
    const provider = taskProvider.trim()
    if (provider.length === 0) return null
    if (!workflowName.trim()) return null
    return evaluateComposerExecutionHint({
      taskProvider: provider,
      workflowYaml,
    })
  }, [enabled, autoMode, taskProvider, workflowName, workflowYaml])

  const [ollamaGuard, setOllamaGuard] = useState<OllamaExecutionGuardPreviewResult | null>(null)
  const [ollamaGuardLoading, setOllamaGuardLoading] = useState(false)

  const shouldPreviewOllama = enabled && taskProvider.trim() === 'ollama' && guardDraft != null

  useEffect(() => {
    if (!shouldPreviewOllama || guardDraft == null) {
      setOllamaGuard(null)
      setOllamaGuardLoading(false)
      return
    }

    let cancelled = false
    setOllamaGuardLoading(true)

    void (async () => {
      try {
        const settings = await window.orbit.getSettings()
        if (ollamaToolsGuardFromUi(settings.config?.ui) === 'off') {
          if (!cancelled) {
            setOllamaGuard({ action: 'allow', issues: [] })
          }
          return
        }
        const result = await window.orbit.previewOllamaExecutionGuard(
          bridgeInputFromDraft(guardDraft, recentWorkflowNames),
        )
        if (!cancelled) setOllamaGuard(result)
      } catch {
        if (!cancelled) setOllamaGuard(null)
      } finally {
        if (!cancelled) setOllamaGuardLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shouldPreviewOllama, guardDraft, recentWorkflowNames])

  return { stepHint, ollamaGuard, ollamaGuardLoading }
}
