import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

export async function updatePendingTaskWorkflow(
  workspacePath: string,
  config: UiConfig,
  taskId: string,
  workflow: string,
): Promise<boolean> {
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  return withTasksYamlLock(tasksYamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return false
    }
    if (!Array.isArray(root.tasks)) return false
    const row = root.tasks.find((candidate) => candidate.name === taskId)
    if (!row) return false
    if (row.status !== 'pending') return false
    row.workflow = workflow
    await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
    return true
  })
}
