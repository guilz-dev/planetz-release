import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { collectRunTraces } from '../lib/run-trace-parser.js'

describe('collectRunTraces', () => {
  async function writeSessionLog(
    runsRoot: string,
    runDirSlug: string,
    sessionId: string,
    lines: object[],
  ): Promise<void> {
    const logsDir = join(runsRoot, runDirSlug, 'logs')
    await mkdir(logsDir, { recursive: true })
    await writeFile(
      join(logsDir, `${sessionId}.jsonl`),
      `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      'utf8',
    )
  }

  async function writeProviderLog(
    runsRoot: string,
    runDirSlug: string,
    sessionId: string,
    lines: object[],
  ): Promise<void> {
    const logsDir = join(runsRoot, runDirSlug, 'logs')
    await mkdir(logsDir, { recursive: true })
    await writeFile(
      join(logsDir, `${sessionId}-provider-events.jsonl`),
      `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      'utf8',
    )
  }

  it('maps provider JSONL lines to RunTraceEvent kinds', async () => {
    const ws = join(tmpdir(), `planetz-trace-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    const taskMap = new Map([['run-dir-a', 'task-1']])
    await writeProviderLog(runsRoot, 'run-dir-a', 'sess-1', [
      {
        timestamp: '2026-05-24T10:00:00.000Z',
        event_type: 'thinking',
        data: { thinking: 'Planning' },
      },
      {
        timestamp: '2026-05-24T10:00:01.000Z',
        event_type: 'tool_use',
        data: { tool: 'Read' },
      },
      {
        timestamp: '2026-05-24T10:00:02.000Z',
        event_type: 'assistant_error',
        data: { error: 'boom' },
      },
      {
        timestamp: '2026-05-24T10:00:03.000Z',
        event_type: 'rate_limit',
        data: { message: 'slow down' },
      },
      {
        timestamp: '2026-05-24T10:00:04.000Z',
        event_type: 'result',
        data: { text: 'done' },
      },
    ])

    const traces = await collectRunTraces(ws, DEFAULT_CONFIG, taskMap)
    const kinds = traces.map((t) => t.type)
    expect(kinds).toEqual(['thinking', 'tool_use', 'assistant_error', 'rate_limit', 'result'])
    expect(traces.every((t) => t.taskId === 'task-1')).toBe(true)
  })

  it('preserves workflow_abort from session JSONL', async () => {
    const ws = join(tmpdir(), `planetz-trace-abort-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeSessionLog(runsRoot, 'run-dir-b', 'sess-2', [
      {
        type: 'workflow_abort',
        reason: 'Operator stopped the run',
        timestamp: '2026-05-24T11:00:00.000Z',
        taskId: 'task-2',
      },
    ])

    const traces = await collectRunTraces(ws, DEFAULT_CONFIG)
    expect(traces).toHaveLength(1)
    expect(traces[0]?.type).toBe('workflow_abort')
    expect(traces[0]?.text).toContain('Operator stopped')
    expect(traces[0]?.level).toBe('error')
  })

  it('maps provider tool_output with full text on the trace', async () => {
    const ws = join(tmpdir(), `planetz-trace-output-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    const longOutput = 'y'.repeat(800)
    await writeProviderLog(runsRoot, 'run-dir-c', 'sess-3', [
      {
        timestamp: '2026-05-24T10:00:00.000Z',
        event_type: 'tool_output',
        data: { output: longOutput },
      },
    ])

    const traces = await collectRunTraces(ws, DEFAULT_CONFIG)
    expect(traces[0]?.type).toBe('tool_output')
    expect(traces[0]?.text).toBe(longOutput)
  })
})
