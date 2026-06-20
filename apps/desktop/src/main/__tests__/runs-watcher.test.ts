import { STATE_BROADCAST_THROTTLE_MS } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRunsWatcherAdditionalRoots, startRunsWatcher } from '../lib/runs-watcher.js'

describe('resolveRunsWatcherAdditionalRoots', () => {
  it('always includes default takt-worktrees parent plus yaml paths', () => {
    expect(
      resolveRunsWatcherAdditionalRoots('/repo/isolated', ['/wt/a/.takt/runs', '/wt/b/.takt/runs']),
    ).toEqual(['/repo/takt-worktrees', '/wt/a/.takt/runs', '/wt/b/.takt/runs'])
  })

  it('deduplicates identical roots', () => {
    expect(
      resolveRunsWatcherAdditionalRoots('/repo/isolated', ['/repo/takt-worktrees/.takt/runs']),
    ).toEqual(['/repo/takt-worktrees', '/repo/takt-worktrees/.takt/runs'])
  })
})

describe('startRunsWatcher fallback poll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes onChange on interval when shouldFallbackPoll returns true', () => {
    const onChange = vi.fn()
    const stop = startRunsWatcher(
      '/tmp/ws',
      { runsDir: '.takt/runs', tasksYamlPath: '.takt/tasks.yaml' } as never,
      onChange,
      {
        fallbackPollMs: 1000,
        shouldFallbackPoll: () => true,
      },
    )

    vi.advanceTimersByTime(1000 + STATE_BROADCAST_THROTTLE_MS)
    expect(onChange).toHaveBeenCalledTimes(1)

    stop()
  })

  it('skips poll ticks when shouldFallbackPoll returns false', () => {
    let poll = false
    const onChange = vi.fn()
    const stop = startRunsWatcher(
      '/tmp/ws',
      { runsDir: '.takt/runs', tasksYamlPath: '.takt/tasks.yaml' } as never,
      onChange,
      {
        fallbackPollMs: 1000,
        shouldFallbackPoll: () => poll,
      },
    )

    vi.advanceTimersByTime(3000)
    expect(onChange).not.toHaveBeenCalled()

    poll = true
    vi.advanceTimersByTime(1000 + STATE_BROADCAST_THROTTLE_MS)
    expect(onChange).toHaveBeenCalledTimes(1)

    stop()
  })
})
