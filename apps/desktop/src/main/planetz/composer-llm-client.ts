import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  COMPOSER_ASSISTANT_TIMEOUT_MS,
  type EngineConfig,
  OLLAMA_LLM_TIMEOUT_MS,
} from '@planetz/shared'
import { execa } from 'execa'
import {
  buildOrbitChildRunnerEnv,
  resolveOrbitChildRunnerBinary,
  traceOrbitChildRunnerSpawn,
} from '../lib/orbit-child-runner.js'
import { resolveRunnableBundledOrbitRoot } from '../takt/exec-cli.js'
import {
  type AssistantTurnJson,
  type FinalizeJson,
  parseAssistantTurnJson,
  parseFinalizeJson,
} from './composer-assistant-json.js'
import {
  buildFinalizeUserPrompt,
  buildTurnUserPrompt,
  COMPOSER_ASSISTANT_FINALIZE_SYSTEM_PROMPT,
  COMPOSER_ASSISTANT_TURN_SYSTEM_PROMPT,
} from './composer-assistant-prompts.js'
import { resolveProviderRuntimeEnv } from './provider-runtime-env.js'

export class ComposerLlmTimeoutError extends Error {
  readonly code = 'timeout'

  constructor(message = 'Composer assistant request timed out') {
    super(message)
    this.name = 'ComposerLlmTimeoutError'
  }
}

export class ComposerLlmParseError extends Error {
  readonly code = 'parse'

  constructor(message = 'Failed to parse composer assistant response') {
    super(message)
    this.name = 'ComposerLlmParseError'
  }
}

export interface ComposerLlmCallContext {
  provider: string
  model?: string
  cwd: string
  workflow?: string
  seedBody?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  engineConfig?: EngineConfig
}

function resolveRunnerScriptPath(): string {
  const candidates = [
    join(process.cwd(), 'apps/desktop/resources/composer-orbit-llm-runner.mjs'),
    join(process.cwd(), 'resources/composer-orbit-llm-runner.mjs'),
  ]
  if (process.resourcesPath?.trim()) {
    candidates.push(join(process.resourcesPath, 'composer-orbit-llm-runner.mjs'))
  }
  for (const root of [
    resolve(process.cwd(), 'third_party', 'orbit'),
    resolve(process.cwd(), 'apps', 'desktop', 'resources', 'orbit'),
  ]) {
    candidates.push(join(root, '..', 'composer-orbit-llm-runner.mjs'))
    candidates.push(join(root, '..', '..', 'composer-orbit-llm-runner.mjs'))
  }
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  throw new Error('composer-orbit-llm-runner.mjs not found')
}

interface RunnerOutput {
  status: string
  content: string
}

/** Calls a bundled-orbit provider via the shared child-process runner. */
function defaultTimeoutMs(provider: string, override?: number): number {
  if (override !== undefined) return override
  if (provider.trim() === 'ollama') return OLLAMA_LLM_TIMEOUT_MS
  return COMPOSER_ASSISTANT_TIMEOUT_MS
}

export async function callOrbitProviderRaw(input: {
  provider: string
  model?: string
  cwd: string
  systemPrompt: string
  prompt: string
  timeoutMs?: number
  engineConfig?: EngineConfig
}): Promise<string> {
  const orbitRoot = resolveRunnableBundledOrbitRoot()
  const runnerPath = resolveRunnerScriptPath()
  const runnerBinary = resolveOrbitChildRunnerBinary()
  const timeoutMs = defaultTimeoutMs(input.provider, input.timeoutMs)
  const providerEnv = input.engineConfig ? resolveProviderRuntimeEnv(input.engineConfig) : {}

  try {
    const subprocess = execa(runnerBinary, [runnerPath], {
      input: JSON.stringify({
        provider: input.provider,
        model: input.model,
        cwd: input.cwd,
        systemPrompt: input.systemPrompt,
        prompt: input.prompt,
        timeoutMs,
      }),
      env: buildOrbitChildRunnerEnv(runnerBinary, {
        ...providerEnv,
        PLANETZ_ORBIT_MODULE_ROOT: orbitRoot,
      }),
      timeout: timeoutMs + 2_000,
      reject: true,
    })
    traceOrbitChildRunnerSpawn('composer-orbit-llm-runner', { runnerBinary }, subprocess)
    const result = await subprocess
    const parsed = JSON.parse(result.stdout) as RunnerOutput
    if (parsed.status === 'error' || parsed.status === 'blocked') {
      throw new Error(parsed.content || `Provider returned status ${parsed.status}`)
    }
    return parsed.content
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('timed out') || error.message.includes('AbortError'))
    ) {
      throw new ComposerLlmTimeoutError()
    }
    throw error
  }
}

async function callWithJsonRetry<T>(input: {
  provider: string
  model?: string
  cwd: string
  systemPrompt: string
  prompt: string
  engineConfig?: EngineConfig
  parse: (content: string) => T
}): Promise<T> {
  const retryPrompt = `${input.prompt}\n\nRespond with JSON only. No markdown fences or preamble.`
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callOrbitProviderRaw({
        provider: input.provider,
        model: input.model,
        cwd: input.cwd,
        systemPrompt: input.systemPrompt,
        prompt: attempt === 0 ? input.prompt : retryPrompt,
        engineConfig: input.engineConfig,
      })
      return input.parse(content)
    } catch (error) {
      lastError = error
      if (error instanceof ComposerLlmTimeoutError) throw error
    }
  }
  throw new ComposerLlmParseError(
    lastError instanceof Error ? lastError.message : 'Failed to parse composer assistant response',
  )
}

export async function askComposerAssistantTurn(
  ctx: ComposerLlmCallContext,
): Promise<AssistantTurnJson> {
  return callWithJsonRetry({
    provider: ctx.provider,
    model: ctx.model,
    cwd: ctx.cwd,
    engineConfig: ctx.engineConfig,
    systemPrompt: COMPOSER_ASSISTANT_TURN_SYSTEM_PROMPT,
    prompt: buildTurnUserPrompt({
      seedBody: ctx.seedBody,
      workflow: ctx.workflow,
      messages: ctx.messages,
    }),
    parse: parseAssistantTurnJson,
  })
}

export async function finalizeComposerAssistant(
  ctx: ComposerLlmCallContext,
): Promise<FinalizeJson> {
  return callWithJsonRetry({
    provider: ctx.provider,
    model: ctx.model,
    cwd: ctx.cwd,
    engineConfig: ctx.engineConfig,
    systemPrompt: COMPOSER_ASSISTANT_FINALIZE_SYSTEM_PROMPT,
    prompt: buildFinalizeUserPrompt({
      workflow: ctx.workflow,
      messages: ctx.messages,
    }),
    parse: parseFinalizeJson,
  })
}
