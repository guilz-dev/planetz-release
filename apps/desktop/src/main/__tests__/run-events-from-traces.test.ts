import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { runEventsFromTraces } from '../lib/run-events-from-traces.js'
import { collectRunEvents } from '../lib/run-events-parser.js'
import { collectRunTraces } from '../lib/run-trace-parser.js'

describe('runEventsFromTraces adapter', () => {
  it('matches collectRunEvents for provider and phase JSONL', async () => {
    const ws = join(tmpdir(), `planetz-trace-adapter-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    const logsDir = join(runsRoot, 'run-dir-a', 'logs')
    await mkdir(logsDir, { recursive: true })
    await writeFile(
      join(logsDir, 'sess-a-provider-events.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-05-27T10:21:00.000Z',
        event_type: 'text',
        step: 'implement',
        data: { text: 'hello' },
      })}\n`,
      'utf8',
    )
    await writeFile(
      join(logsDir, 'sess-a.jsonl'),
      `${JSON.stringify({
        type: 'phase_start',
        phaseName: 'execute',
        timestamp: '2026-05-27T10:20:00.000Z',
      })}\n`,
      'utf8',
    )
    const map = new Map([['run-dir-a', 'task-a']])
    const legacy = await collectRunEvents(ws, DEFAULT_CONFIG, map)
    const traces = await collectRunTraces(ws, DEFAULT_CONFIG, map)
    const adapted = runEventsFromTraces(traces)
    expect(adapted).toEqual(legacy)
  })
})
