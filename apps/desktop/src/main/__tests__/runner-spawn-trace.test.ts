import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRunnerSpawnTraceEnabled, logRunnerSpawnTrace } from '../lib/runner-spawn-trace.js'

describe('runner-spawn-trace', () => {
  const savedTraceRunner = process.env.PLANETZ_TRACE_RUNNER
  const savedTraceEnqueue = process.env.PLANETZ_TRACE_ENQUEUE

  afterEach(() => {
    if (savedTraceRunner === undefined) {
      delete process.env.PLANETZ_TRACE_RUNNER
    } else {
      process.env.PLANETZ_TRACE_RUNNER = savedTraceRunner
    }
    if (savedTraceEnqueue === undefined) {
      delete process.env.PLANETZ_TRACE_ENQUEUE
    } else {
      process.env.PLANETZ_TRACE_ENQUEUE = savedTraceEnqueue
    }
    vi.restoreAllMocks()
  })

  it('is disabled by default', () => {
    delete process.env.PLANETZ_TRACE_RUNNER
    delete process.env.PLANETZ_TRACE_ENQUEUE
    expect(isRunnerSpawnTraceEnabled()).toBe(false)
  })

  it('logs when PLANETZ_TRACE_RUNNER is enabled', () => {
    process.env.PLANETZ_TRACE_RUNNER = '1'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logRunnerSpawnTrace('orbit-interactive-runner', { op: 'turn', pid: 42 })
    expect(info).toHaveBeenCalledWith(expect.stringContaining('orbit-interactive-runner'))
    expect(info.mock.calls[0]?.[0]).toContain('op=turn')
    expect(info.mock.calls[0]?.[0]).toContain('pid=42')
  })
})
