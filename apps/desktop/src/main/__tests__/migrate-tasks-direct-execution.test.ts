import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { migrateTasksToDirectExecutionIfNeeded } from '../lib/migrate-tasks-direct-execution.js'

describe('migrateTasksToDirectExecutionIfNeeded', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('strips worktree and pr fields for pending tasks with worktree intent', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-pending-migrate-'))
    const tasksYamlPath = join(workspace, DEFAULT_CONFIG.tasksYamlPath)
    await mkdir(dirname(tasksYamlPath), { recursive: true })
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: pending-1
    status: pending
    task_dir: .takt/tasks/pending-1
    worktree: true
    auto_pr: true
    draft_pr: false
    managed_pr: true
  - name: pending-2
    status: pending
    task_dir: .takt/tasks/pending-2
    worktree: custom/path
    auto_pr: true
  - name: done-1
    status: completed
    task_dir: .takt/tasks/done-1
    worktree: true
    auto_pr: true
`,
      'utf8',
    )

    const migrated = await migrateTasksToDirectExecutionIfNeeded(workspace, DEFAULT_CONFIG)
    expect(migrated).toEqual({ changed: true, migratedCount: 2 })

    const yaml = await readFile(tasksYamlPath, 'utf8')
    const root = parseYaml(yaml) as { tasks: Array<Record<string, unknown>> }
    const pending1 = root.tasks.find((row) => row.name === 'pending-1')
    const pending2 = root.tasks.find((row) => row.name === 'pending-2')
    const done1 = root.tasks.find((row) => row.name === 'done-1')
    expect(pending1).toBeDefined()
    expect(pending2).toBeDefined()
    expect(done1).toBeDefined()
    expect(pending1).not.toHaveProperty('worktree')
    expect(pending1).not.toHaveProperty('auto_pr')
    expect(pending1).not.toHaveProperty('draft_pr')
    expect(pending1).not.toHaveProperty('managed_pr')
    expect(pending2).not.toHaveProperty('worktree')
    expect(pending2).not.toHaveProperty('auto_pr')
    expect(done1).toHaveProperty('worktree', true)
    expect(done1).toHaveProperty('auto_pr', true)
  })

  it('strips worktree fields for failed tasks so retry uses direct execution', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-failed-migrate-'))
    const tasksYamlPath = join(workspace, DEFAULT_CONFIG.tasksYamlPath)
    await mkdir(dirname(tasksYamlPath), { recursive: true })
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: failed-1
    status: failed
    task_dir: .takt/tasks/failed-1
    worktree: true
    auto_pr: true
`,
      'utf8',
    )

    const migrated = await migrateTasksToDirectExecutionIfNeeded(workspace, DEFAULT_CONFIG)
    expect(migrated).toEqual({ changed: true, migratedCount: 1 })

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const failed = root.tasks.find((row) => row.name === 'failed-1')
    expect(failed).toBeDefined()
    expect(failed).not.toHaveProperty('worktree')
    expect(failed).not.toHaveProperty('auto_pr')
  })

  it('is idempotent when migration already applied', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-pending-migrate-idempotent-'))
    const tasksYamlPath = join(workspace, DEFAULT_CONFIG.tasksYamlPath)
    await mkdir(dirname(tasksYamlPath), { recursive: true })
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: pending-1
    status: pending
    task_dir: .takt/tasks/pending-1
`,
      'utf8',
    )

    const migrated = await migrateTasksToDirectExecutionIfNeeded(workspace, DEFAULT_CONFIG)
    expect(migrated).toEqual({ changed: false, migratedCount: 0 })
  })

  it('returns unchanged when tasks.yaml is missing', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-pending-migrate-missing-'))
    await expect(migrateTasksToDirectExecutionIfNeeded(workspace, DEFAULT_CONFIG)).resolves.toEqual(
      { changed: false, migratedCount: 0 },
    )
  })
})
