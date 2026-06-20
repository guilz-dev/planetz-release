import type { TaskViewModel, UiState } from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-store.js'
import type { TaskCommandPort } from './task-command-port.js'

/** Shared rollback + persist flags for enqueue/derive mutations. */
export type TaskMutationContext = {
  paths: SidecarPaths
  mockTasksBefore: TaskViewModel[] | null
  sidecarPersisted: boolean
}

export function prepareTaskMutationContext(port: TaskCommandPort): TaskMutationContext {
  return {
    paths: port.requireSidecarPaths(),
    mockTasksBefore: port.mockQueueEnabled() ? port.mockTasks : null,
    sidecarPersisted: false,
  }
}

export async function persistTaskMutationSideEffects(
  ctx: TaskMutationContext,
  persist: () => Promise<void>,
): Promise<void> {
  await persist()
  ctx.sidecarPersisted = true
}

export function applyTaskMutationUiState(port: TaskCommandPort, nextUiState: UiState): void {
  port.syncUiState(nextUiState)
}

export async function finalizeTaskMutation(port: TaskCommandPort): Promise<void> {
  await port.refreshState()
}

export function rollbackTaskMutationIfNeeded(
  port: TaskCommandPort,
  ctx: TaskMutationContext,
): void {
  if (ctx.mockTasksBefore !== null && !ctx.sidecarPersisted) {
    port.mockTasks = ctx.mockTasksBefore
  }
}
