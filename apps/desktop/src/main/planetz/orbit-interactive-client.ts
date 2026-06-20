import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMPOSER_ASSISTANT_TIMEOUT_MS,
  type EngineConfig,
  headlessInteractiveUnavailableMessage,
  OLLAMA_LLM_TIMEOUT_MS,
  ORBIT_INTERACTIVE_CONTRACT_VERSION,
  type OrbitInteractiveOp,
  type OrbitInteractiveRequest,
  type OrbitInteractiveResponse,
  type OrbitInteractiveSnapshot,
  type OrbitInteractiveStreamLine,
  type OrbitInteractiveToolsProfile,
  orbitInteractiveResponseSchema,
  type PlanetzSessionPolicy,
  parseOrbitInteractiveStreamLine,
  resolveOrbitInteractiveToolsProfile,
} from '@planetz/shared'
import { execa } from 'execa'
import {
  buildOrbitChildRunnerEnv,
  resolveOrbitChildRunnerBinary,
  traceOrbitChildRunnerSpawn,
} from '../lib/orbit-child-runner.js'
import { candidateBundledOrbitRoots, resolveRunnableBundledOrbitRoot } from '../takt/exec-cli.js'
import { ComposerLlmTimeoutError } from './composer-llm-client.js'
import { resolveProviderRuntimeEnv } from './provider-runtime-env.js'

function resolveRunnerScriptPath(): string {
  const candidates = [
    join(process.cwd(), 'apps/desktop/resources/orbit-interactive-session-runner.mjs'),
    join(process.cwd(), 'resources/orbit-interactive-session-runner.mjs'),
  ]
  if (process.resourcesPath?.trim()) {
    candidates.push(join(process.resourcesPath, 'orbit-interactive-session-runner.mjs'))
  }
  for (const root of [
    resolve(process.cwd(), 'third_party', 'orbit'),
    resolve(process.cwd(), 'apps', 'desktop', 'resources', 'orbit'),
  ]) {
    candidates.push(join(root, '..', 'orbit-interactive-session-runner.mjs'))
  }
  const moduleDir = fileURLToPath(new URL('.', import.meta.url))
  candidates.push(join(moduleDir, '../../../resources/orbit-interactive-session-runner.mjs'))
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  throw new OrbitInteractiveClientError(
    headlessInteractiveUnavailableMessage('orbit-interactive-session-runner.mjs not found'),
    'runner',
  )
}

function defaultTimeoutMs(provider: string): number {
  if (provider.trim() === 'ollama') return OLLAMA_LLM_TIMEOUT_MS
  return COMPOSER_ASSISTANT_TIMEOUT_MS
}

const STREAMING_PROCESS_TIMEOUT_MS = 30 * 60_000

const HEADLESS_SESSION_RELATIVE_PATH = join('dist', 'features', 'interactive', 'headlessSession.js')

function hasRunnableOrbitLayout(root: string): boolean {
  return existsSync(join(root, 'package.json')) && existsSync(join(root, 'node_modules'))
}

function resolveInteractiveOrbitRoot(): string {
  for (const root of candidateBundledOrbitRoots()) {
    if (!hasRunnableOrbitLayout(root)) continue
    if (existsSync(join(root, HEADLESS_SESSION_RELATIVE_PATH))) return root
  }

  const fallbackRoot = resolveRunnableBundledOrbitRoot()
  if (existsSync(join(fallbackRoot, HEADLESS_SESSION_RELATIVE_PATH))) {
    return fallbackRoot
  }

  throw new OrbitInteractiveClientError(
    headlessInteractiveUnavailableMessage(
      `Missing ${HEADLESS_SESSION_RELATIVE_PATH} in bundled orbit root: ${fallbackRoot}`,
    ),
    'runner',
  )
}

export class OrbitInteractiveClientError extends Error {
  constructor(
    message: string,
    readonly code: 'contract' | 'runner' | 'timeout' = 'runner',
  ) {
    super(message)
    this.name = 'OrbitInteractiveClientError'
  }
}

function parseRunnerResponse(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) {
    throw new Error('Runner returned empty stdout')
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    // Some bundled orbit builds can print conversational traces to stdout
    // before the final JSON response. Accept the last parseable JSON payload.
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!line) continue
    try {
      return JSON.parse(line) as unknown
    } catch {
      // continue
    }
  }

  const jsonStart = trimmed.lastIndexOf('{"contractVersion"')
  if (jsonStart >= 0) {
    const candidate = trimmed.slice(jsonStart)
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      // continue to final error
    }
  }

  throw new Error(`Runner stdout did not contain valid JSON: ${trimmed.slice(0, 200)}`)
}

/** @internal Exported for unit tests. */
export function feedOrbitInteractiveStreamStderr(
  chunk: string,
  buffer: { remainder: string },
  onLine: (line: OrbitInteractiveStreamLine) => void,
): void {
  buffer.remainder += chunk
  let newlineIndex = buffer.remainder.indexOf('\n')
  while (newlineIndex >= 0) {
    const rawLine = buffer.remainder.slice(0, newlineIndex)
    buffer.remainder = buffer.remainder.slice(newlineIndex + 1)
    const parsed = parseOrbitInteractiveStreamLine(rawLine)
    if (parsed) onLine(parsed)
    newlineIndex = buffer.remainder.indexOf('\n')
  }
}

export interface InvokeRunnerOptions {
  provider: string
  engineConfig?: EngineConfig
  signal?: AbortSignal
  onStreamLine?: (line: OrbitInteractiveStreamLine) => void
}

async function invokeRunner(
  request: OrbitInteractiveRequest,
  options: InvokeRunnerOptions,
): Promise<OrbitInteractiveResponse> {
  const orbitRoot = resolveInteractiveOrbitRoot()
  const runnerPath = resolveRunnerScriptPath()
  const runnerBinary = resolveOrbitChildRunnerBinary()
  const timeoutMs = defaultTimeoutMs(options.provider)
  const providerEnv = options.engineConfig ? resolveProviderRuntimeEnv(options.engineConfig) : {}

  const streamEnabled = options.onStreamLine !== undefined
  const stderrBuffer = { remainder: '' }
  const processTimeoutMs = streamEnabled ? STREAMING_PROCESS_TIMEOUT_MS : timeoutMs + 5_000

  try {
    const runnerEnv = buildOrbitChildRunnerEnv(runnerBinary, {
      ...providerEnv,
      PLANETZ_ORBIT_MODULE_ROOT: orbitRoot,
      ...(streamEnabled ? { PLANETZ_HEADLESS_STREAM: '1' } : {}),
    })

    const subprocess = execa(runnerBinary, [runnerPath], {
      input: JSON.stringify(request),
      env: runnerEnv,
      timeout: processTimeoutMs,
      cancelSignal: options.signal,
      reject: true,
      stderr: streamEnabled ? 'pipe' : undefined,
    })

    traceOrbitChildRunnerSpawn(
      'orbit-interactive-runner',
      { op: request.op, runnerBinary },
      subprocess,
    )

    if (streamEnabled && subprocess.stderr) {
      subprocess.stderr.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        feedOrbitInteractiveStreamStderr(text, stderrBuffer, (line) => {
          options.onStreamLine?.(line)
        })
      })
    }

    const result = await subprocess

    if (streamEnabled && stderrBuffer.remainder.trim()) {
      const parsed = parseOrbitInteractiveStreamLine(stderrBuffer.remainder)
      if (parsed) options.onStreamLine?.(parsed)
      stderrBuffer.remainder = ''
    }

    const parsed = parseRunnerResponse(result.stdout)
    const response = orbitInteractiveResponseSchema.safeParse(parsed)
    if (!response.success) {
      throw new OrbitInteractiveClientError(
        headlessInteractiveUnavailableMessage(`Invalid runner response: ${response.error.message}`),
        'contract',
      )
    }
    if (response.data.contractVersion !== ORBIT_INTERACTIVE_CONTRACT_VERSION) {
      throw new OrbitInteractiveClientError(
        headlessInteractiveUnavailableMessage(
          'Bundled orbit contract mismatch; restart the app after updating.',
        ),
        'contract',
      )
    }
    return response.data
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('timed out') || error.message.includes('AbortError'))
    ) {
      throw new ComposerLlmTimeoutError()
    }
    if (error instanceof OrbitInteractiveClientError || error instanceof ComposerLlmTimeoutError) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new OrbitInteractiveClientError(headlessInteractiveUnavailableMessage(message), 'runner')
  }
}

export interface OrbitInteractiveStartInput {
  cwd: string
  workflow: string
  planetzSessionId: string
  provider: string
  model?: string
  effort?: string
  seedBody?: string
  sourceContext?: string
  sessionPolicy?: PlanetzSessionPolicy
  toolsProfile?: OrbitInteractiveToolsProfile
  mcpServers?: import('@planetz/shared').McpServersFile
  allowedToolsOverride?: string[]
  engineConfig?: EngineConfig
}

export async function orbitInteractiveStart(
  input: OrbitInteractiveStartInput,
): Promise<OrbitInteractiveResponse> {
  const toolsProfile = input.toolsProfile ?? resolveOrbitInteractiveToolsProfile()
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'start',
      snapshot: null,
      payload: {
        cwd: input.cwd,
        workflow: input.workflow,
        planetzSessionId: input.planetzSessionId,
        provider: input.provider,
        model: input.model,
        effort: input.effort,
        seedBody: input.seedBody,
        sourceContext: input.sourceContext,
        sessionPolicy: input.sessionPolicy,
        toolsProfile,
        ...(input.mcpServers ? { mcpServers: input.mcpServers } : {}),
        ...(input.allowedToolsOverride ? { allowedToolsOverride: input.allowedToolsOverride } : {}),
      },
    },
    { provider: input.provider, engineConfig: input.engineConfig },
  )
}

export interface OrbitInteractiveTurnOptions {
  engineConfig?: EngineConfig
  signal?: AbortSignal
  onStreamLine?: (line: OrbitInteractiveStreamLine) => void
}

export async function orbitInteractiveTurn(
  snapshot: OrbitInteractiveSnapshot,
  message: string,
  options?: OrbitInteractiveTurnOptions,
): Promise<OrbitInteractiveResponse> {
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'turn',
      snapshot,
      payload: { message },
    },
    {
      provider: snapshot.provider,
      engineConfig: options?.engineConfig,
      signal: options?.signal,
      onStreamLine: options?.onStreamLine,
    },
  )
}

export async function orbitInteractiveFinalize(
  snapshot: OrbitInteractiveSnapshot,
  note?: string,
  engineConfig?: EngineConfig,
): Promise<OrbitInteractiveResponse> {
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'finalize',
      snapshot,
      payload: note ? { note } : {},
    },
    { provider: snapshot.provider, engineConfig },
  )
}

export async function orbitInteractiveAccept(
  snapshot: OrbitInteractiveSnapshot,
): Promise<OrbitInteractiveResponse> {
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'accept',
      snapshot,
      payload: {},
    },
    { provider: snapshot.provider },
  )
}

export async function orbitInteractivePlay(
  snapshot: OrbitInteractiveSnapshot,
  task: string,
): Promise<OrbitInteractiveResponse> {
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'play',
      snapshot,
      payload: { task },
    },
    { provider: snapshot.provider },
  )
}

export async function orbitInteractiveCancel(
  snapshot: OrbitInteractiveSnapshot,
): Promise<OrbitInteractiveResponse> {
  return invokeRunner(
    {
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'cancel',
      snapshot,
      payload: {},
    },
    { provider: snapshot.provider },
  )
}

export function assertOrbitInteractiveOk(
  response: OrbitInteractiveResponse,
): asserts response is OrbitInteractiveResponse & {
  ok: true
  result: NonNullable<OrbitInteractiveResponse['result']>
} {
  if (!response.result) {
    throw new OrbitInteractiveClientError(
      headlessInteractiveUnavailableMessage(
        response.error ?? 'Headless interactive request failed',
      ),
      'contract',
    )
  }
  if (response.result.kind === 'error') {
    throw new OrbitInteractiveClientError(response.result.error, 'runner')
  }
  if (!response.ok) {
    throw new OrbitInteractiveClientError(
      headlessInteractiveUnavailableMessage(
        response.error ?? 'Headless interactive request failed',
      ),
      'contract',
    )
  }
}

export type { OrbitInteractiveOp, OrbitInteractiveSnapshot }
