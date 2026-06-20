import {
  type EngineConfig,
  type FinalSelectionCandidateSummary,
  type TaskRoutingRequirements,
  type WorkflowFinalSelection,
  workflowFinalSelectionSchema,
} from '@planetz/shared'
import { parseJsonFromLlm } from '../../lib/parse-llm-json.js'
import { callWorkflowAutoRoutingLlmJson } from './llm-client.js'
import { buildFinalSelectionSystemPrompt, buildFinalSelectionUserPrompt } from './prompt-builder.js'

export async function selectWorkflowFinal(input: {
  prompt: string
  requirements: TaskRoutingRequirements
  candidates: FinalSelectionCandidateSummary[]
  provider: string
  model?: string
  cwd: string
  engineConfig: EngineConfig
}): Promise<WorkflowFinalSelection> {
  const allowed = new Set(input.candidates.map((c) => c.workflowName))
  const selection = await callWorkflowAutoRoutingLlmJson({
    provider: input.provider,
    model: input.model,
    cwd: input.cwd,
    engineConfig: input.engineConfig,
    systemPrompt: buildFinalSelectionSystemPrompt(),
    prompt: buildFinalSelectionUserPrompt(input.prompt, input.requirements, input.candidates),
    parse: (content) => parseJsonFromLlm(content, workflowFinalSelectionSchema),
  })
  if (!allowed.has(selection.selectedWorkflow)) {
    throw new Error(`final selection workflow not in candidates: ${selection.selectedWorkflow}`)
  }
  return selection
}
