import {
  type EngineConfig,
  type EnqueueTaskBridgeInput,
  type EnqueueTaskInput,
  hasTaskBodyContent,
  normalizeTaskBodyForSubmit,
  TASK_TITLE_LLM_TIMEOUT_MS,
} from '@planetz/shared'
import { callOrbitProviderRaw } from '../planetz/composer-llm-client.js'

const TITLE_MAX_LENGTH = 80

const TASK_TITLE_SYSTEM_PROMPT =
  'Return a short single-line task title in the same language as input. No quotes. Output only the title.'

export interface TaskTitleLlmContext {
  provider: string
  model?: string
  cwd: string
  engineConfig?: EngineConfig
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripControlChars(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    out += code <= 0x1f || code === 0x7f ? ' ' : ch
  }
  return out
}

/** Normalizes task titles for storage, comparison, and CLI prompt assembly. */
export function normalizeEnqueueTitle(raw: string): string {
  const oneLine = raw.replace(/\r?\n/g, ' ')
  const clean = compactWhitespace(stripControlChars(oneLine))
  if (clean.length <= TITLE_MAX_LENGTH) return clean
  return clean.slice(0, TITLE_MAX_LENGTH).trim()
}

function fallbackTimestampTitle(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `task-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`
}

function firstLineFallback(body: string): string {
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  return normalizeEnqueueTitle(firstLine)
}

async function generateWithOrbitProvider(
  body: string,
  ctx: TaskTitleLlmContext,
): Promise<string | null> {
  try {
    const content = await callOrbitProviderRaw({
      provider: ctx.provider,
      model: ctx.model,
      cwd: ctx.cwd,
      systemPrompt: TASK_TITLE_SYSTEM_PROMPT,
      prompt: body,
      timeoutMs: TASK_TITLE_LLM_TIMEOUT_MS,
      engineConfig: ctx.engineConfig,
    })
    const generated = normalizeEnqueueTitle(content)
    return generated.length > 0 ? generated : null
  } catch {
    return null
  }
}

export async function resolveEnqueueInput(
  input: EnqueueTaskBridgeInput,
  llm?: TaskTitleLlmContext,
): Promise<EnqueueTaskInput> {
  const body = normalizeTaskBodyForSubmit(input.body)
  if (!hasTaskBodyContent(body)) {
    throw new Error('Task body is required')
  }
  const explicit = normalizeEnqueueTitle(input.title ?? '')
  if (explicit.length > 0) {
    return { ...input, body, title: explicit }
  }
  const generated = llm ? await generateWithOrbitProvider(body, llm) : null
  const fallback = firstLineFallback(body)
  const title = generated ?? (fallback.length > 0 ? fallback : fallbackTimestampTitle())
  return { ...input, body, title }
}
