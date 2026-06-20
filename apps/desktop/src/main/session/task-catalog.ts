import { resolve } from 'node:path'
import type { TaskViewModel, UiConfig } from '@planetz/shared'
import { readTasksFromYaml } from '../lib/tasks-yaml-reader.js'
import { type TaskYamlRefreshAccess, taskIdSet } from './task-yaml-access.js'

/**
 * tasks.yaml access with an explicit read-model cache.
 *
 * - `loadCached`: refresh / projection only (one cycle per `invalidate`)
 * - `readFresh`: command gates (never reads or writes the refresh cache)
 */
export class TaskCatalog implements TaskYamlRefreshAccess {
  private cacheKey: string | null = null
  private tasks: TaskViewModel[] | null = null

  invalidate(): void {
    this.tasks = null
    this.cacheKey = null
  }

  /** Cached read for state refresh after `invalidate`. */
  async loadCached(workspacePath: string, config: UiConfig): Promise<TaskViewModel[]> {
    const key = resolve(workspacePath)
    if (this.cacheKey === key && this.tasks) {
      return this.tasks
    }
    this.tasks = await readTasksFromYaml(workspacePath, config)
    this.cacheKey = key
    return this.tasks
  }

  /** Uncached disk read for command / mutation gates (does not read or write the refresh cache). */
  readFresh(workspacePath: string, config: UiConfig): Promise<TaskViewModel[]> {
    return readTasksFromYaml(workspacePath, config)
  }

  idSet(tasks: TaskViewModel[]): Set<string> {
    return taskIdSet(tasks)
  }
}
