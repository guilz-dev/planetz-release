import type { AutoWorkflowDecision } from '@planetz/shared'
import type { PromptComposerRunDraft } from './prompt-composer-run-draft.js'

export type WorkflowRoutingPreviewState = {
  previewToken: string | null
  promptHash: string | null
  previewDecision?: AutoWorkflowDecision | null
  confirmedWorkflow?: string
}

export function shouldBlockLowConfidenceGate(
  gateEnabled: boolean,
  workflowMode: 'manual' | 'auto',
  routing: WorkflowRoutingPreviewState,
): boolean {
  return (
    gateEnabled &&
    workflowMode === 'auto' &&
    routing.previewDecision?.confidence === 'low' &&
    !routing.confirmedWorkflow
  )
}

export function routingPreviewToEnqueueExtras(
  routing: WorkflowRoutingPreviewState,
): Pick<
  Parameters<typeof window.orbit.enqueueTask>[0],
  'routingPreviewToken' | 'routingPromptHash' | 'confirmedWorkflow'
> {
  return {
    ...(routing.previewToken ? { routingPreviewToken: routing.previewToken } : {}),
    ...(routing.promptHash ? { routingPromptHash: routing.promptHash } : {}),
    ...(routing.confirmedWorkflow ? { confirmedWorkflow: routing.confirmedWorkflow } : {}),
  }
}

/** When the gate is on, run full LLM routing before enqueue to obtain final confidence. */
export async function ensureFullAutoPreviewForGate(input: {
  gateEnabled: boolean
  workflowMode: 'manual' | 'auto'
  routing: WorkflowRoutingPreviewState
  title?: string
  body?: string
  provider?: string
  model?: string
}): Promise<WorkflowRoutingPreviewState & { gateBlocked: boolean }> {
  if (!input.gateEnabled || input.workflowMode !== 'auto' || input.routing.confirmedWorkflow) {
    return { ...input.routing, gateBlocked: false }
  }

  try {
    const result = await window.orbit.previewWorkflowAutoRoute({
      title: input.title,
      body: input.body,
      phase: 'full',
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
    })
    const next: WorkflowRoutingPreviewState = {
      previewToken: result.previewToken,
      promptHash: result.promptHash,
      previewDecision: result.decision,
      confirmedWorkflow: input.routing.confirmedWorkflow,
    }
    return {
      ...next,
      gateBlocked: shouldBlockLowConfidenceGate(true, 'auto', next),
    }
  } catch {
    return {
      ...input.routing,
      gateBlocked: shouldBlockLowConfidenceGate(
        input.gateEnabled,
        input.workflowMode,
        input.routing,
      ),
    }
  }
}

export function mergeRoutingIntoComposerDraft(
  draft: PromptComposerRunDraft,
  routing: WorkflowRoutingPreviewState,
): PromptComposerRunDraft {
  return {
    ...draft,
    ...routingPreviewToEnqueueExtras(routing),
    ...(routing.confirmedWorkflow
      ? {
          confirmedWorkflow: routing.confirmedWorkflow,
          workflowMode: 'manual' as const,
          workflow: routing.confirmedWorkflow,
        }
      : {}),
  }
}
