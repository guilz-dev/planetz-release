import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

interface TasksYamlRoot {
  tasks?: Array<{ name?: string; status?: string; task_dir?: string }>
}

/** Remove a pending task from tasks.yaml and delete its package directory. */
export async function deletePendingTaskPackage(
  workspacePath: string,
  config: UiConfig,
  taskId: string,
): Promise<boolean> {
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  return withTasksYamlLock(tasksYamlPath, async () => {
    const { readFile, writeFile } = await import('node:fs/promises')
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return false
    }
    if (!Array.isArray(root.tasks)) return false
    const idx = root.tasks.findIndex((t) => t.name === taskId)
    if (idx < 0) return false
    const row = root.tasks[idx]
    if ((row.status ?? 'pending').toLowerCase() !== 'pending') return false
    const taskDir = row.task_dir
    root.tasks.splice(idx, 1)
    await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
    if (taskDir) {
      await rm(join(workspacePath, taskDir), { recursive: true, force: true })
    }
    return true
  })
}
