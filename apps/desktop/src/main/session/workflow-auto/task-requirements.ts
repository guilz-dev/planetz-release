import {
  type AutoWorkflowLlmFailureCode,
  type EngineConfig,
  ROUTING_REASON_CODES,
  type TaskRoutingRequirements,
  taskRoutingRequirementsSchema,
} from '@planetz/shared'
import { parseJsonFromLlm } from '../../lib/parse-llm-json.js'
import { inferTaskRoutingRequirementsFromPrompt } from '../workflow-auto-classifier.js'
import { callWorkflowAutoRoutingLlmJson, routingLlmFailureCodeFromError } from './llm-client.js'
import {
  buildTaskRequirementsSystemPrompt,
  buildTaskRequirementsUserPrompt,
} from './prompt-builder.js'

export type TaskRequirementsExtractResult = {
  requirements: TaskRoutingRequirements
  reasonCodes: string[]
  meta?: {
    provider?: string
    model?: string
    latencyMs?: number
    failureCode?: AutoWorkflowLlmFailureCode
  }
}

export async function extractTaskRoutingRequirements(input: {
  prompt: string
  provider?: string
  model?: string
  cwd: string
  engineConfig: EngineConfig
}): Promise<TaskRequirementsExtractResult> {
  const provider = input.provider?.trim()
  if (!provider) {
    return {
      requirements: inferTaskRoutingRequirementsFromPrompt(input.prompt),
      reasonCodes: [ROUTING_REASON_CODES.requirements.noProvider],
    }
  }

  const startedAt = Date.now()
  try {
    const requirements = await callWorkflowAutoRoutingLlmJson({
      provider,
      model: input.model,
      cwd: input.cwd,
      engineConfig: input.engineConfig,
      systemPrompt: buildTaskRequirementsSystemPrompt(),
      prompt: buildTaskRequirementsUserPrompt(input.prompt),
      parse: (content) => parseJsonFromLlm(content, taskRoutingRequirementsSchema),
    })
    return {
      requirements,
      reasonCodes: [ROUTING_REASON_CODES.requirements.llm],
      meta: {
        provider,
        model: input.model,
        latencyMs: Date.now() - startedAt,
      },
    }
  } catch (error: unknown) {
    return {
      requirements: inferTaskRoutingRequirementsFromPrompt(input.prompt),
      reasonCodes: [ROUTING_REASON_CODES.requirements.fallback],
      meta: {
        provider,
        model: input.model,
        latencyMs: Date.now() - startedAt,
        failureCode: routingLlmFailureCodeFromError(error),
      },
    }
  }
}
