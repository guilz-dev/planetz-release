import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMPOSER_DEFAULT_WORKFLOW_NAME, DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { TaskPackageWriter } from '../takt/task-package-writer.js'

describe('TaskPackageWriter', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) {
      const { rm } = await import('node:fs/promises')
      await rm(workspace, { recursive: true, force: true })
      workspace = ''
    }
  })

  it('creates order.md and tasks.yaml record compatible with §11', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'takt-writer-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeEmptyTasks(tasksYamlPath)

    const config = { ...DEFAULT_CONFIG }
    const writer = new TaskPackageWriter(workspace, config)
    const result = await writer.createPackage(
      { title: 'Implement auth', body: 'Add login flow', workflow: 'default', issueNumber: 368 },
      new Set(),
    )

    expect(result.taskId).toBeTruthy()
    const order = await readFile(join(workspace, result.taskDir, 'order.md'), 'utf8')
    expect(order).toContain('Add login flow')

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const row = root.tasks.find((t) => t.name === result.taskId)
    expect(row).toBeDefined()
    expect(row?.status).toBe('pending')
    expect(row?.task_dir).toBe(result.taskDir)
    expect(row?.issue).toBe(368)
    expect(row?.workflow).toBe('default')
  })

  it('stores workflow short name when runtime path is passed', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'takt-writer-workflow-path-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeEmptyTasks(tasksYamlPath)

    const config = { ...DEFAULT_CONFIG }
    const writer = new TaskPackageWriter(workspace, config)
    const result = await writer.createPackage(
      { title: 'Path task', workflow: '.orbit/workflows/default.yaml' },
      new Set(),
    )

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const row = root.tasks.find((t) => t.name === result.taskId)
    expect(row?.workflow).toBe('default')
    expect(row?.execution_profile).toBeUndefined()
  })

  it('defaults workflow to composer default when omitted', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'takt-writer-default-workflow-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeEmptyTasks(tasksYamlPath)

    const writer = new TaskPackageWriter(workspace, { ...DEFAULT_CONFIG })
    const result = await writer.createPackage({ title: 'Generic task' }, new Set())

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const row = root.tasks.find((t) => t.name === result.taskId)
    expect(row?.workflow).toBe(COMPOSER_DEFAULT_WORKFLOW_NAME)
  })

  it('uses existing ids in tasks.yaml when generating a new task id', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'takt-writer-existing-id-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: implement-auth
    status: pending
    task_dir: .takt/tasks/seed
`,
      'utf8',
    )

    const writer = new TaskPackageWriter(workspace, { ...DEFAULT_CONFIG })
    const result = await writer.createPackage({ title: 'Implement auth' }, new Set())
    expect(result.taskId).toBe('implement-auth-2')
  })

  it('assigns unique ids under concurrent enqueue calls', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'takt-writer-concurrent-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeEmptyTasks(tasksYamlPath)

    const writer = new TaskPackageWriter(workspace, { ...DEFAULT_CONFIG })
    const [first, second] = await Promise.all([
      writer.createPackage({ title: 'Concurrent task' }, new Set()),
      writer.createPackage({ title: 'Concurrent task' }, new Set()),
    ])
    expect(first.taskId).not.toBe(second.taskId)

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const names = root.tasks
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string')
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain(first.taskId)
    expect(names).toContain(second.taskId)
  })
})

async function writeEmptyTasks(path: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(path, 'tasks: []\n', 'utf8')
}
