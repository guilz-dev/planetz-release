import {
  type AutoWorkflowLlmFailureCode,
  type EngineConfig,
  WORKFLOW_ROUTING_LLM_TIMEOUT_MS,
} from '@planetz/shared'
import { ZodError } from 'zod'
import { ComposerLlmTimeoutError, callOrbitProviderRaw } from '../../planetz/composer-llm-client.js'

export class WorkflowAutoRoutingParseError extends Error {
  readonly code = 'parse'

  constructor(message = 'Failed to parse routing LLM response') {
    super(message)
    this.name = 'WorkflowAutoRoutingParseError'
  }
}

export async function callWorkflowAutoRoutingLlm(input: {
  provider: string
  model?: string
  cwd: string
  systemPrompt: string
  prompt: string
  engineConfig?: EngineConfig
}): Promise<string> {
  return callOrbitProviderRaw({
    provider: input.provider,
    model: input.model,
    cwd: input.cwd,
    systemPrompt: input.systemPrompt,
    prompt: input.prompt,
    timeoutMs: WORKFLOW_ROUTING_LLM_TIMEOUT_MS,
    engineConfig: input.engineConfig,
  })
}

const ROUTING_JSON_RETRY_SUFFIX =
  '\n\nRespond with a single JSON object only. No markdown fences, no commentary, no trailing text.'

/** Calls routing LLM with JSON-only retries on parse failures (not on timeout). */
export async function callWorkflowAutoRoutingLlmJson<T>(input: {
  provider: string
  model?: string
  cwd: string
  systemPrompt: string
  prompt: string
  engineConfig?: EngineConfig
  parse: (content: string) => T
}): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const content = await callWorkflowAutoRoutingLlm({
        provider: input.provider,
        model: input.model,
        cwd: input.cwd,
        systemPrompt: input.systemPrompt,
        prompt: attempt === 0 ? input.prompt : `${input.prompt}${ROUTING_JSON_RETRY_SUFFIX}`,
        engineConfig: input.engineConfig,
      })
      return input.parse(content)
    } catch (error) {
      lastError = error
      if (error instanceof ComposerLlmTimeoutError) throw error
    }
  }
  if (lastError instanceof ZodError || lastError instanceof SyntaxError) {
    throw new WorkflowAutoRoutingParseError(
      lastError instanceof Error ? lastError.message : 'Failed to parse routing LLM response',
    )
  }
  throw new WorkflowAutoRoutingParseError(
    lastError instanceof Error ? lastError.message : 'Failed to parse routing LLM response',
  )
}

export function routingLlmFailureCodeFromError(error: unknown): AutoWorkflowLlmFailureCode {
  if (error instanceof ComposerLlmTimeoutError) return 'timeout'
  if (error instanceof WorkflowAutoRoutingParseError || error instanceof SyntaxError) {
    return 'invalid-json'
  }
  return 'provider-error'
}

export { ComposerLlmTimeoutError }
