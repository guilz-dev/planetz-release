import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RunEvent } from '@planetz/shared'
import { DEFAULT_CONFIG, formatRunId } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  collectRunEvents,
  resolveActiveStep,
  resolveActiveStepFromRunEvents,
} from '../lib/run-events-parser.js'

describe('resolveActiveStep', () => {
  it('highlights step from latest step_start for task', () => {
    const runId = formatRunId('dir-a', 's1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 's1',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:00:00.000Z',
        message: 'plan',
      },
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 's1',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:05:00.000Z',
        message: 'implement',
      },
    ]
    expect(resolveActiveStep(events, 'task-1', ['plan', 'implement', 'review'])).toBe('implement')
  })
})

describe('resolveActiveStepFromRunEvents', () => {
  it('matches resolveActiveStep when stream is already task-scoped', () => {
    const runId = formatRunId('dir-a', 's1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 's1',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:00:00.000Z',
        message: 'plan',
      },
    ]
    expect(resolveActiveStepFromRunEvents(events, ['plan', 'implement'])).toBe('plan')
  })
})

describe('collectRunEvents – Orbit runtime JSONL format', () => {
  async function writeRunLog(
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

  it('reads timestamp field when at is absent', async () => {
    const ws = join(tmpdir(), `planetz-test-ts-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-a', 'sess-1', [
      {
        type: 'step_start',
        step: 'plan',
        timestamp: '2026-05-27T10:00:00.000Z',
      },
    ])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG)
    expect(events).toHaveLength(1)
    expect(events[0].at).toBe('2026-05-27T10:00:00.000Z')
    expect(events[0].message).toBe('plan')
  })

  it('tags events with taskId from runDirSlugToTaskId when JSONL has no taskId', async () => {
    const ws = join(tmpdir(), `planetz-test-tid-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-b', 'sess-2', [
      { type: 'step_start', step: 'plan', timestamp: '2026-05-27T10:00:00.000Z' },
      { type: 'step_complete', step: 'plan', timestamp: '2026-05-27T10:05:00.000Z' },
    ])
    const map = new Map([['run-dir-b', 'my-task']])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG, map)
    expect(events).toHaveLength(2)
    expect(events[0].taskId).toBe('my-task')
    expect(events[1].taskId).toBe('my-task')
  })

  it('prefers explicit taskId over map lookup', async () => {
    const ws = join(tmpdir(), `planetz-test-pref-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-c', 'sess-3', [
      {
        type: 'step_start',
        step: 'plan',
        taskId: 'explicit-task',
        timestamp: '2026-05-27T10:00:00.000Z',
      },
    ])
    const map = new Map([['run-dir-c', 'map-task']])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG, map)
    expect(events[0].taskId).toBe('explicit-task')
  })

  it('maps workflow_abort reason and endTime from Orbit JSONL', async () => {
    const ws = join(tmpdir(), `planetz-test-abort-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-abort', 'sess-abort', [
      {
        type: 'workflow_abort',
        reason: 'agent exceeded budget',
        endTime: '2026-05-27T14:51:44.325Z',
      },
    ])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('workflow_abort')
    expect(events[0].at).toBe('2026-05-27T14:51:44.325Z')
    expect(events[0].message).toBe('agent exceeded budget')
  })

  it('maps phase_complete content into log events for activity projection', async () => {
    const ws = join(tmpdir(), `planetz-test-phase-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-phase', 'sess-phase', [
      {
        type: 'phase_complete',
        step: 'write_tests',
        phaseName: 'execute',
        content: 'Here is the planner output for tests.',
        timestamp: '2026-05-27T10:20:00.000Z',
      },
    ])
    const map = new Map([['run-dir-phase', 'task-phase']])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG, map)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('log')
    expect(events[0].message).toContain('Here is the planner output')
    expect(events[0].message).toContain('[phase:execute]')
  })

  it('maps provider-events.jsonl text chunks into log events', async () => {
    const ws = join(tmpdir(), `planetz-test-prov-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    const logsDir = join(runsRoot, 'run-dir-prov', 'logs')
    await mkdir(logsDir, { recursive: true })
    await writeFile(
      join(logsDir, 'sess-prov-provider-events.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-05-27T10:21:00.000Z',
        event_type: 'text',
        step: 'write_tests',
        data: { text: 'Streaming token chunk from provider.' },
      })}\n`,
      'utf8',
    )
    const map = new Map([['run-dir-prov', 'task-prov']])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG, map)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('log')
    expect(events[0].message).toBe('Streaming token chunk from provider.')
    expect(events[0].step).toBe('write_tests')
    expect(events[0].taskId).toBe('task-prov')
  })

  it('maps persona from step_start JSONL when present', async () => {
    const ws = join(tmpdir(), `planetz-test-persona-step-${Date.now()}`)
    const runsRoot = join(ws, DEFAULT_CONFIG.runsDir)
    await writeRunLog(runsRoot, 'run-dir-p', 'sess-p', [
      {
        type: 'step_start',
        step: 'implement',
        persona_display_name: 'coder-runtime',
        timestamp: '2026-05-27T10:00:00.000Z',
      },
    ])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG)
    const stepStart = events.find((e) => e.type === 'step_start')
    expect(stepStart?.persona).toBe('coder-runtime')
    expect(stepStart?.step).toBe('implement')
  })

  it('collects events from additional run roots (worktree runs)', async () => {
    const ws = join(tmpdir(), `planetz-test-extra-root-${Date.now()}`)
    const worktree = join(tmpdir(), `planetz-test-extra-worktree-${Date.now()}`)
    const extraRunsRoot = join(worktree, DEFAULT_CONFIG.runsDir)
    await writeRunLog(extraRunsRoot, 'run-dir-wt', 'sess-9', [
      { type: 'step_start', step: 'implement', timestamp: '2026-05-27T10:10:00.000Z' },
    ])
    const map = new Map([['run-dir-wt', 'task-from-worktree']])
    const events = await collectRunEvents(ws, DEFAULT_CONFIG, map, [extraRunsRoot])
    expect(events).toHaveLength(1)
    expect(events[0].taskId).toBe('task-from-worktree')
    expect(events[0].message).toBe('implement')
  })
})
