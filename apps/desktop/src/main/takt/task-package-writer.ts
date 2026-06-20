import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EnqueueTaskInput, UiConfig } from '@planetz/shared'
import { slugifyTaskId, uniqueTaskId } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { withTasksYamlLock } from '../lib/tasks-yaml-lock.js'
import { normalizeWorkflowForTasksYaml } from '../lib/tasks-yaml-takt-compat.js'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

function timestampSlug(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export interface TaskPackageResult {
  taskId: string
  taskDir: string
}

export class TaskPackageWriter {
  constructor(
    private readonly workspacePath: string,
    private readonly config: UiConfig,
  ) {}

  async createPackage(
    input: EnqueueTaskInput,
    existingIds: Set<string>,
  ): Promise<TaskPackageResult> {
    const tasksYamlPath = join(this.workspacePath, this.config.tasksYamlPath)
    const body = input.body?.trim() || input.title
    return withTasksYamlLock(tasksYamlPath, () =>
      createTaskPackageUnderLock({
        workspacePath: this.workspacePath,
        tasksYamlPath,
        tasksDir: this.config.tasksDir,
        title: input.title,
        body,
        issueNumber: input.issueNumber,
        workflow: input.workflow,
        existingIds,
      }),
    )
  }
}

interface CreateTaskPackageUnderLockParams {
  workspacePath: string
  tasksYamlPath: string
  tasksDir: string
  title: string
  body: string
  issueNumber?: number
  workflow?: string
  existingIds: Set<string>
}

interface TaskPackageIdentity {
  taskId: string
  taskDirRel: string
  taskDirAbs: string
}

async function createTaskPackageUnderLock(
  params: CreateTaskPackageUnderLockParams,
): Promise<TaskPackageResult> {
  const {
    workspacePath,
    tasksYamlPath,
    tasksDir,
    title,
    body,
    issueNumber,
    workflow,
    existingIds,
  } = params
  let root: TasksYamlRoot = { tasks: [] }
  try {
    const raw = await readFile(tasksYamlPath, 'utf8')
    root = (parseYaml(raw) as TasksYamlRoot) ?? { tasks: [] }
  } catch {
    root = { tasks: [] }
  }
  if (!Array.isArray(root.tasks)) root.tasks = []
  const identity = resolveNextTaskPackageIdentity({
    title,
    tasksDir,
    workspacePath,
    existingIds,
    tasks: root.tasks,
  })
  await writeTaskPackageFiles(identity, body)
  root.tasks.push(buildTaskRecord(identity.taskId, identity.taskDirRel, workflow, issueNumber))
  await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
  return { taskId: identity.taskId, taskDir: identity.taskDirRel }
}

function resolveNextTaskPackageIdentity(params: {
  title: string
  tasksDir: string
  workspacePath: string
  existingIds: Set<string>
  tasks: Array<Record<string, unknown>>
}): TaskPackageIdentity {
  const { title, tasksDir, workspacePath, existingIds, tasks } = params
  const existingInYaml = new Set(
    tasks
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0),
  )
  const mergedExisting = new Set([...existingInYaml, ...existingIds])
  const taskId = uniqueTaskId(title, mergedExisting)
  const slug = slugifyTaskId(taskId)
  const dirName = `${timestampSlug()}-${slug}`
  const taskDirRel = join(tasksDir, dirName).replace(/\\/g, '/')
  const taskDirAbs = join(workspacePath, taskDirRel)
  return { taskId, taskDirRel, taskDirAbs }
}

async function writeTaskPackageFiles(identity: TaskPackageIdentity, body: string): Promise<void> {
  await mkdir(identity.taskDirAbs, { recursive: true })
  await writeFile(join(identity.taskDirAbs, 'order.md'), `${body}\n`, 'utf8')
}

function buildTaskRecord(
  taskId: string,
  taskDirRel: string,
  workflow?: string,
  issueNumber?: number,
): Record<string, unknown> {
  const normalizedIssueNumber =
    typeof issueNumber === 'number' && Number.isInteger(issueNumber) && issueNumber > 0
      ? issueNumber
      : undefined
  return {
    name: taskId,
    status: 'pending',
    task_dir: taskDirRel,
    ...(normalizedIssueNumber === undefined ? {} : { issue: normalizedIssueNumber }),
    workflow: normalizeWorkflowForTasksYaml(workflow),
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  }
}
