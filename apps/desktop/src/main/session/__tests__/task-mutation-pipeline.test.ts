import type { TaskViewModel } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import type { TaskCommandPort } from '../task-command-port.js'
import {
  applyTaskMutationUiState,
  finalizeTaskMutation,
  persistTaskMutationSideEffects,
  prepareTaskMutationContext,
  rollbackTaskMutationIfNeeded,
} from '../task-mutation-pipeline.js'

function createPort(overrides: Partial<TaskCommandPort> = {}): TaskCommandPort {
  const mockTasks: TaskViewModel[] = [{ id: 't1' } as TaskViewModel]
  return {
    mockQueueEnabled: () => true,
    mockTasks,
    requireSidecarPaths: () => mockSidecarPaths('/tmp/ws'),
    syncUiState: vi.fn(),
    refreshState: vi.fn(async () => ({}) as never),
    ...overrides,
  } as TaskCommandPort
}

describe('task-mutation-pipeline', () => {
  it('prepareTaskMutationContext captures mock snapshot before mutation', () => {
    const port = createPort()
    const before = port.mockTasks
    const ctx = prepareTaskMutationContext(port)
    port.mockTasks = [{ id: 't2' } as TaskViewModel]
    expect(ctx.mockTasksBefore).toBe(before)
    expect(ctx.sidecarPersisted).toBe(false)
  })

  it('rollbackTaskMutationIfNeeded restores mock tasks when persist did not complete', () => {
    const port = createPort()
    const ctx = prepareTaskMutationContext(port)
    const snapshot = ctx.mockTasksBefore
    port.mockTasks = [{ id: 'mutated' } as TaskViewModel]
    rollbackTaskMutationIfNeeded(port, ctx)
    expect(port.mockTasks).toBe(snapshot)
  })

  it('rollbackTaskMutationIfNeeded is a no-op after sidecar persist', async () => {
    const port = createPort()
    const ctx = prepareTaskMutationContext(port)
    port.mockTasks = [{ id: 'mutated' } as TaskViewModel]
    await persistTaskMutationSideEffects(ctx, async () => {})
    rollbackTaskMutationIfNeeded(port, ctx)
    expect(port.mockTasks[0]?.id).toBe('mutated')
  })

  it('applyTaskMutationUiState syncs ui state on the port', () => {
    const syncUiState = vi.fn()
    const port = createPort({ syncUiState })
    const nextUiState = { selectedTaskId: 'task-2' } as never
    applyTaskMutationUiState(port, nextUiState)
    expect(syncUiState).toHaveBeenCalledWith(nextUiState)
  })

  it('finalizeTaskMutation refreshes app state', async () => {
    const refreshState = vi.fn(async () => ({}) as never)
    const port = createPort({ refreshState })
    await finalizeTaskMutation(port)
    expect(refreshState).toHaveBeenCalledOnce()
  })

  it('persistTaskMutationSideEffects marks context persisted', async () => {
    const port = createPort()
    const ctx = prepareTaskMutationContext(port)
    const persist = vi.fn(async () => {})
    await persistTaskMutationSideEffects(ctx, persist)
    expect(persist).toHaveBeenCalledOnce()
    expect(ctx.sidecarPersisted).toBe(true)
  })
})
