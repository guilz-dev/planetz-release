import type { TaskViewModel, UiConfig } from '@planetz/shared'

/** Refresh / projection: may use `TaskCatalog.loadCached` after invalidate. */
export interface TaskYamlRefreshAccess {
  invalidate(): void
  loadCached(workspacePath: string, config: UiConfig): Promise<TaskViewModel[]>
  idSet(tasks: TaskViewModel[]): Set<string>
}

/** Command gates: disk read via `TaskCatalog.readFresh` only (never loadCached). */
export interface TaskYamlCommandAccess {
  readTaktTasksFresh(): Promise<TaskViewModel[]>
  readTaktTasksFreshAt(taktRepoPath: string): Promise<TaskViewModel[]>
  invalidateTaktTaskYamlCache(): void
  taktTaskIdSet(tasks: TaskViewModel[]): Set<string>
}

export function taskIdSet(tasks: TaskViewModel[]): Set<string> {
  return new Set(tasks.map((t) => t.id))
}
