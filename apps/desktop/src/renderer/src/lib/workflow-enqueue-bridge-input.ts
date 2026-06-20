import type { PromptComposerRunDraft } from './prompt-composer-run-draft.js'
import { routingPreviewToEnqueueExtras } from './workflow-low-confidence-gate.js'

function draftRoutingPreview(
  draft: Pick<
    PromptComposerRunDraft,
    'routingPreviewToken' | 'routingPromptHash' | 'confirmedWorkflow'
  >,
) {
  return {
    previewToken: draft.routingPreviewToken ?? null,
    promptHash: draft.routingPromptHash ?? null,
    confirmedWorkflow: draft.confirmedWorkflow,
  }
}

/** Maps composer draft to IPC enqueue / run-now input. */
export function workflowEnqueueBridgeInput(
  draft: PromptComposerRunDraft,
  recentWorkflowNames: string[],
): Parameters<typeof window.orbit.enqueueTask>[0] {
  return {
    body: draft.body,
    workflowMode: draft.workflowMode,
    ...(draft.workflowMode === 'manual' && draft.workflow ? { workflow: draft.workflow } : {}),
    recentWorkflowNames,
    ...(draft.provider ? { provider: draft.provider } : {}),
    ...(draft.model ? { model: draft.model } : {}),
    ...routingPreviewToEnqueueExtras(draftRoutingPreview(draft)),
    ...(draft.runOverride ? { runOverride: draft.runOverride } : {}),
    ...(draft.workflowSelectionKind ? { workflowSelectionKind: draft.workflowSelectionKind } : {}),
    ...(draft.sourceThreadId ? { sourceThreadId: draft.sourceThreadId } : {}),
  }
}
