import { type OllamaExecutionGuardPreviewInput, ollamaToolsGuardFromUi } from '@planetz/shared'
import type { TranslateFn } from '../i18n/index.js'
import { formatOllamaGuardIssues } from './format-ollama-guard-issues.js'
import type { PromptComposerRunDraft } from './prompt-composer-run-draft.js'

function bridgeInputFromDraft(
  draft: PromptComposerRunDraft,
  recentWorkflowNames: string[],
): OllamaExecutionGuardPreviewInput {
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

/** When tools guard is warn, returns a user-facing message if the workflow looks incompatible. */
export async function ollamaGuardWarnMessageForDraft(
  draft: PromptComposerRunDraft,
  recentWorkflowNames: string[],
  t: TranslateFn,
): Promise<string | null> {
  // Auto mode without an explicit workflow: routing LLM has not run yet; preview would use fallback only.
  if (draft.workflowMode === 'auto' && !draft.workflow?.trim()) {
    return null
  }

  const settings = await window.orbit.getSettings()
  if (ollamaToolsGuardFromUi(settings.config?.ui) !== 'warn') return null

  const result = await window.orbit.previewOllamaExecutionGuard(
    bridgeInputFromDraft(draft, recentWorkflowNames),
  )
  if (result.action !== 'warn' || result.issues.length === 0) return null
  return formatOllamaGuardIssues(result.issues, t)
}
