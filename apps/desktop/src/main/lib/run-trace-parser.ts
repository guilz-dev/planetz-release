import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { formatRunId, type UiConfig } from '@planetz/shared'
import { runEventsFromTraces } from './run-events-from-traces.js'
import { firstNonEmptyAbortMessage } from './run-trace-text.js'
import type { RunTraceEvent } from './run-trace-types.js'

export type { RunTraceEvent, RunTraceEventType } from './run-trace-types.js'

const PROVIDER_EVENTS_SUFFIX = '-provider-events.jsonl'

interface JsonlEvent {
  type?: string
  at?: string
  timestamp?: string
  endTime?: string
  step?: string
  persona?: string
  persona_display_name?: string
  personaDisplayName?: string
  message?: string
  content?: string
  phaseName?: string
  reason?: string
  level?: 'info' | 'warn' | 'error'
  taskId?: string
  sessionId?: string
}

interface ProviderEventLine {
  timestamp?: string
  event_type?: string
  step?: string
  data?: Record<string, unknown>
}

interface RunLogContext {
  runId: string
  runDirSlug: string
  sessionId: string
  taskId: string | undefined
}

export async function collectRunTraces(
  workspacePath: string,
  config: UiConfig,
  runDirSlugToTaskId?: ReadonlyMap<string, string>,
  additionalRunRoots?: readonly string[],
): Promise<RunTraceEvent[]> {
  const runRoots = new Set<string>([
    join(workspacePath, config.runsDir),
    ...(additionalRunRoots ?? []),
  ])
  const events: RunTraceEvent[] = []
  const seenLogFiles = new Set<string>()

  for (const runsRoot of runRoots) {
    let runDirs: string[]
    try {
      runDirs = await readdir(runsRoot, { withFileTypes: true }).then((ents) =>
        ents.filter((e) => e.isDirectory()).map((e) => e.name),
      )
    } catch {
      continue
    }

    for (const runDirSlug of runDirs) {
      const logsDir = join(runsRoot, runDirSlug, 'logs')
      let logFiles: string[]
      try {
        logFiles = await readdir(logsDir)
      } catch {
        continue
      }
      const taskId = runDirSlugToTaskId?.get(runDirSlug)

      for (const file of logFiles.filter((f) => f.endsWith('.jsonl'))) {
        const logPath = join(logsDir, file)
        if (seenLogFiles.has(logPath)) continue
        seenLogFiles.add(logPath)

        if (file.endsWith(PROVIDER_EVENTS_SUFFIX)) {
          const sessionId = file.slice(0, -PROVIDER_EVENTS_SUFFIX.length)
          const ctx: RunLogContext = {
            runId: formatRunId(runDirSlug, sessionId),
            runDirSlug,
            sessionId,
            taskId,
          }
          const parsed = await readJsonlLines(logPath)
          for (const line of parsed) {
            const mapped = mapProviderLineToRunTrace(line as ProviderEventLine, ctx)
            if (mapped) events.push(mapped)
          }
          continue
        }

        const sessionId = file.replace(/\.jsonl$/, '')
        const ctx: RunLogContext = {
          runId: formatRunId(runDirSlug, sessionId),
          runDirSlug,
          sessionId,
          taskId,
        }
        const lines = await readJsonlLines(logPath)
        for (const line of lines) {
          const mapped = mapJsonlToRunTrace(line as JsonlEvent, ctx, runDirSlugToTaskId)
          if (mapped) events.push(mapped)
        }
      }
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at))
}

async function readJsonlLines(logPath: string): Promise<unknown[]> {
  const raw = await readFile(logPath, 'utf8').catch(() => '')
  const out: unknown[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line) as unknown)
    } catch {}
  }
  return out
}

function mapJsonlToRunTrace(
  parsed: JsonlEvent,
  ctx: RunLogContext,
  runDirSlugToTaskId?: ReadonlyMap<string, string>,
): RunTraceEvent | null {
  const at = parsed.at ?? parsed.timestamp ?? parsed.endTime ?? new Date().toISOString()
  const taskId = parsed.taskId ?? ctx.taskId ?? runDirSlugToTaskId?.get(ctx.runDirSlug)
  const base = {
    runId: ctx.runId,
    runDirSlug: ctx.runDirSlug,
    sessionId: ctx.sessionId,
    taskId,
    at,
  }
  const type = parsed.type

  if (type === 'step_start') {
    const stepName = parsed.step ?? parsed.message
    const persona =
      parsed.persona?.trim() ||
      parsed.persona_display_name?.trim() ||
      parsed.personaDisplayName?.trim() ||
      undefined
    const name = typeof stepName === 'string' ? stepName : undefined
    return {
      ...base,
      type: 'step_start',
      stepName: name?.trim() || undefined,
      text: name,
      ...(persona ? { persona } : {}),
    }
  }
  if (type === 'step_complete') {
    const stepName = parsed.step ?? parsed.message
    return {
      ...base,
      type: 'step_complete',
      stepName: typeof stepName === 'string' ? stepName : undefined,
      text: typeof stepName === 'string' ? stepName : undefined,
      content: typeof parsed.content === 'string' ? parsed.content : undefined,
    }
  }
  if (type === 'phase_start') {
    return {
      ...base,
      type: 'phase_start',
      phaseName: parsed.phaseName?.trim(),
    }
  }
  if (type === 'phase_complete') {
    return {
      ...base,
      type: 'phase_complete',
      phaseName: parsed.phaseName?.trim(),
      content: typeof parsed.content === 'string' ? parsed.content : undefined,
    }
  }
  if (type === 'workflow_complete' || type === 'workflow_abort') {
    const text =
      type === 'workflow_abort'
        ? firstNonEmptyAbortMessage(parsed.reason, parsed.message)
        : parsed.message
    return {
      ...base,
      type,
      text: typeof text === 'string' ? text : undefined,
      level: type === 'workflow_abort' ? 'error' : 'info',
    }
  }
  if (type === 'log' || parsed.message) {
    return {
      ...base,
      type: 'log',
      text: parsed.message,
      level: parsed.level ?? 'info',
      stepName: parsed.step?.trim(),
    }
  }
  return null
}

function mapProviderLineToRunTrace(
  parsed: ProviderEventLine,
  ctx: RunLogContext,
): RunTraceEvent | null {
  const at = parsed.timestamp ?? new Date().toISOString()
  const base = {
    runId: ctx.runId,
    runDirSlug: ctx.runDirSlug,
    sessionId: ctx.sessionId,
    taskId: ctx.taskId,
    at,
  }
  const stepName = parsed.step?.trim()
  const eventType = parsed.event_type
  const data = parsed.data ?? {}

  if (eventType === 'text') {
    const text = typeof data.text === 'string' ? data.text : ''
    if (!text.trim()) return null
    return { ...base, type: 'text', text, stepName, level: 'info' }
  }
  if (eventType === 'thinking') {
    const thinking = typeof data.thinking === 'string' ? data.thinking : ''
    if (!thinking.trim()) return null
    return { ...base, type: 'thinking', text: thinking, stepName, level: 'info' }
  }
  if (eventType === 'tool_use') {
    const tool = typeof data.tool === 'string' ? data.tool : 'tool'
    return { ...base, type: 'tool_use', toolName: tool, stepName, level: 'info' }
  }
  if (eventType === 'tool_result') {
    const content = typeof data.content === 'string' ? data.content : ''
    if (!content.trim()) return null
    return {
      ...base,
      type: 'tool_result',
      text: content,
      stepName,
      isError: Boolean(data.isError),
      level: data.isError ? 'error' : 'info',
    }
  }
  if (eventType === 'tool_output') {
    const output = typeof data.output === 'string' ? data.output : ''
    if (!output.trim()) return null
    return { ...base, type: 'tool_output', text: output, stepName, level: 'info' }
  }
  if (eventType === 'assistant_error') {
    const err =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : ''
    if (!err.trim()) return null
    return { ...base, type: 'assistant_error', text: err, stepName, level: 'error' }
  }
  if (eventType === 'rate_limit') {
    return {
      ...base,
      type: 'rate_limit',
      text: typeof data.message === 'string' ? data.message : 'rate limit',
      stepName,
      level: 'warn',
    }
  }
  if (eventType === 'result') {
    const text =
      typeof data.text === 'string' ? data.text : typeof data.result === 'string' ? data.result : ''
    if (!text.trim()) return null
    return { ...base, type: 'result', text, stepName, level: 'info' }
  }
  return null
}

/** Legacy API: single disk read, adapter-compatible `RunEvent[]`. */
export async function collectRunEvents(
  workspacePath: string,
  config: UiConfig,
  runDirSlugToTaskId?: ReadonlyMap<string, string>,
  additionalRunRoots?: readonly string[],
) {
  const traces = await collectRunTraces(
    workspacePath,
    config,
    runDirSlugToTaskId,
    additionalRunRoots,
  )
  return runEventsFromTraces(traces)
}
