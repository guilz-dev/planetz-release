import type { RunEvent } from '@planetz/shared'
import type { RunTraceEvent } from '../lib/run-trace-types.js'

/** §7.1: `runId = {runDirSlug}:{sessionId}`. */
function composeRunId(runDirSlug: string, sessionId: string): string {
  return `${runDirSlug}:${sessionId}`
}

export interface RunSeed {
  taskId: string
  runDirSlug: string
  sessionId: string
  steps: string[]
  /** Index of the step currently running. `-1` = not started; `steps.length` = all complete. */
  cursor: number
  startedAt: string
}

const INITIAL_RUN_SEEDS: RunSeed[] = [
  {
    taskId: 'implement-auth-core',
    runDirSlug: '20260524-101200-implement-auth-core',
    sessionId: 'session-7f3a',
    steps: ['plan', 'implement', 'review'],
    cursor: 1,
    startedAt: new Date().toISOString(),
  },
  {
    taskId: 'fix-flaky-test',
    runDirSlug: '20260524-093000-fix-flaky-test',
    sessionId: 'session-9c2b',
    steps: ['red', 'green', 'refactor'],
    cursor: 1,
    startedAt: new Date().toISOString(),
  },
]

/** Mutable mock timeline; reset in tests via `resetMockRunSeeds`. */
let runSeeds: RunSeed[] = INITIAL_RUN_SEEDS.map((s) => ({ ...s, steps: [...s.steps] }))

export function getMockRunSeeds(): readonly RunSeed[] {
  return runSeeds
}

export function resetMockRunSeeds(): void {
  runSeeds = INITIAL_RUN_SEEDS.map((s) => ({
    ...s,
    steps: [...s.steps],
    startedAt: new Date().toISOString(),
  }))
}

/**
 * Create a run seed when a mock task becomes running without a predefined fixture.
 */
export function hasMockRunSeed(taskId: string): boolean {
  return runSeeds.some((s) => s.taskId === taskId)
}

export function ensureMockRunSeed(taskId: string, stepNames: readonly string[]): void {
  if (stepNames.length === 0) return
  if (hasMockRunSeed(taskId)) return
  const slug = taskId.replace(/[^a-z0-9-]+/gi, '-').slice(0, 48)
  runSeeds.push({
    taskId,
    runDirSlug: `mock-${slug}`,
    sessionId: 'session-mock',
    steps: [...stepNames],
    cursor: 0,
    startedAt: new Date().toISOString(),
  })
}

/**
 * Advance the active step for running tasks (mock animator tick).
 * Returns true when any seed moved forward.
 */
export function advanceMockRunSeeds(runningTaskIds: ReadonlySet<string>): boolean {
  let changed = false
  const now = new Date().toISOString()
  runSeeds = runSeeds.map((seed) => {
    if (!runningTaskIds.has(seed.taskId)) return seed
    if (seed.cursor >= seed.steps.length - 1) return seed
    changed = true
    return { ...seed, cursor: seed.cursor + 1, startedAt: now }
  })
  return changed
}

export function buildRunTraces(seed: RunSeed): RunTraceEvent[] {
  const traces: RunTraceEvent[] = []
  const runId = composeRunId(seed.runDirSlug, seed.sessionId)
  const baseMs = Date.parse(seed.startedAt)
  for (let i = 0; i < seed.steps.length; i += 1) {
    if (i > seed.cursor) break
    const at = new Date(baseMs + i * 1000).toISOString()
    const stepName = seed.steps[i]
    traces.push({
      runId,
      runDirSlug: seed.runDirSlug,
      sessionId: seed.sessionId,
      taskId: seed.taskId,
      type: 'step_start',
      at,
      stepName,
      text: stepName,
      level: 'info',
    })
    if (i < seed.cursor) {
      traces.push({
        runId,
        runDirSlug: seed.runDirSlug,
        sessionId: seed.sessionId,
        taskId: seed.taskId,
        type: 'step_complete',
        at: new Date(baseMs + i * 1000 + 500).toISOString(),
        stepName,
        text: stepName,
        level: 'info',
      })
    }
  }
  return traces
}

export function buildRunEvents(seed: RunSeed): RunEvent[] {
  const events: RunEvent[] = []
  const runId = composeRunId(seed.runDirSlug, seed.sessionId)
  const baseMs = Date.parse(seed.startedAt)
  for (let i = 0; i < seed.steps.length; i += 1) {
    if (i > seed.cursor) break
    const at = new Date(baseMs + i * 1000).toISOString()
    const stepName = seed.steps[i]
    events.push({
      runId,
      runDirSlug: seed.runDirSlug,
      sessionId: seed.sessionId,
      taskId: seed.taskId,
      type: 'step_start',
      at,
      message: stepName,
      level: 'info',
    })
    if (i < seed.cursor) {
      events.push({
        runId,
        runDirSlug: seed.runDirSlug,
        sessionId: seed.sessionId,
        taskId: seed.taskId,
        type: 'step_complete',
        at: new Date(baseMs + i * 1000 + 500).toISOString(),
        message: stepName,
        level: 'info',
      })
    }
  }
  return events
}

export function activeRunIdFor(seed: RunSeed): string {
  return composeRunId(seed.runDirSlug, seed.sessionId)
}

export function activeStepName(seed: RunSeed): string | undefined {
  if (seed.cursor < 0 || seed.cursor >= seed.steps.length) return undefined
  return seed.steps[seed.cursor]
}

/** Synthetic terminal events for failed/exceeded mock tasks (used to drive failure UI). */
const FAILED_RUN_EVENTS_BY_TASK_ID: Record<string, RunEvent[]> = (() => {
  const brokenRunId = 'mock-broken-migration:session-mock'
  const brokenSlug = 'mock-broken-migration'
  const brokenSession = 'session-mock'
  const brokenStartMs = Date.now() - 60 * 60_000
  const brokenAt = (offsetSec: number) => new Date(brokenStartMs + offsetSec * 1000).toISOString()

  const longRunId = 'mock-long-research:session-mock'
  const longSlug = 'mock-long-research'
  const longSession = 'session-mock'
  const longStartMs = Date.now() - 120 * 60_000
  const longAt = (offsetSec: number) => new Date(longStartMs + offsetSec * 1000).toISOString()

  return {
    'broken-migration': [
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'step_start',
        at: brokenAt(0),
        message: 'plan',
        level: 'info',
      },
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'step_complete',
        at: brokenAt(2),
        message: 'plan',
        level: 'info',
      },
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'step_start',
        at: brokenAt(3),
        message: 'implement',
        level: 'info',
      },
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'log',
        at: brokenAt(20),
        level: 'warn',
        message: 'backfill is slower than expected; locks held > 30s',
      },
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'log',
        at: brokenAt(45),
        level: 'error',
        message:
          'ERROR 23502: null value in column "created_by" of relation "orders" violates not-null constraint',
      },
      {
        runId: brokenRunId,
        runDirSlug: brokenSlug,
        sessionId: brokenSession,
        taskId: 'broken-migration',
        type: 'workflow_abort',
        at: brokenAt(46),
        message: 'Migration backfill failed: 312 rows still NULL after backfill window.',
      },
    ],
    'long-research': [
      {
        runId: longRunId,
        runDirSlug: longSlug,
        sessionId: longSession,
        taskId: 'long-research',
        type: 'step_start',
        at: longAt(0),
        message: 'research',
        level: 'info',
      },
      {
        runId: longRunId,
        runDirSlug: longSlug,
        sessionId: longSession,
        taskId: 'long-research',
        type: 'log',
        at: longAt(900),
        level: 'warn',
        message: 'token budget 80% consumed without conclusion',
      },
      {
        runId: longRunId,
        runDirSlug: longSlug,
        sessionId: longSession,
        taskId: 'long-research',
        type: 'workflow_abort',
        at: longAt(1800),
        message: 'Run exceeded configured token budget.',
      },
    ],
  }
})()

export function getMockFailureEvents(taskId: string): RunEvent[] {
  return FAILED_RUN_EVENTS_BY_TASK_ID[taskId] ?? []
}

const FAILED_RUN_TRACES_BY_TASK_ID: Record<string, RunTraceEvent[]> = Object.fromEntries(
  Object.entries(FAILED_RUN_EVENTS_BY_TASK_ID).map(([taskId, events]) => [
    taskId,
    events.map(runEventToMockTrace),
  ]),
)

function runEventToMockTrace(ev: RunEvent): RunTraceEvent {
  const type =
    ev.type === 'step_start' || ev.type === 'step_complete' || ev.type === 'workflow_abort'
      ? ev.type
      : ev.type === 'workflow_complete'
        ? 'workflow_complete'
        : 'log'
  return {
    runId: ev.runId,
    runDirSlug: ev.runDirSlug,
    sessionId: ev.sessionId,
    taskId: ev.taskId,
    at: ev.at,
    type,
    stepName: ev.step?.trim() ?? ev.message?.trim(),
    text: ev.message,
    content: ev.content,
    level: ev.level,
  }
}

/** Flatten mock run seeds + failure fixtures into a time-ordered trace stream. */
export function collectMockRunTraces(): RunTraceEvent[] {
  const seedTraces = runSeeds.flatMap(buildRunTraces)
  const failureTraces = Object.values(FAILED_RUN_TRACES_BY_TASK_ID).flat()
  return [...seedTraces, ...failureTraces].sort((a, b) => a.at.localeCompare(b.at))
}

/** Flatten mock run seeds + failure fixtures into a time-ordered event stream. */
export function collectMockRunEvents(): RunEvent[] {
  const seedEvents = runSeeds.flatMap(buildRunEvents)
  const failureEvents = Object.values(FAILED_RUN_EVENTS_BY_TASK_ID).flat()
  return [...seedEvents, ...failureEvents].sort((a, b) => a.at.localeCompare(b.at))
}
