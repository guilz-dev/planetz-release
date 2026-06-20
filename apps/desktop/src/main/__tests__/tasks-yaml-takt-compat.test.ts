import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMPOSER_DEFAULT_WORKFLOW_NAME, DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  normalizeWorkflowForTasksYaml,
  sanitizeTasksYamlForTakt,
} from '../lib/tasks-yaml-takt-compat.js'

describe('normalizeWorkflowForTasksYaml', () => {
  it('defaults empty workflow to composer default', () => {
    expect(normalizeWorkflowForTasksYaml()).toBe(COMPOSER_DEFAULT_WORKFLOW_NAME)
    expect(normalizeWorkflowForTasksYaml('')).toBe(COMPOSER_DEFAULT_WORKFLOW_NAME)
    expect(normalizeWorkflowForTasksYaml('   ')).toBe(COMPOSER_DEFAULT_WORKFLOW_NAME)
  })

  it('keeps explicit workflow short names and strips paths', () => {
    expect(normalizeWorkflowForTasksYaml('default')).toBe('default')
    expect(normalizeWorkflowForTasksYaml('.orbit/runtime-workflows/default.yaml')).toBe('default')
    expect(normalizeWorkflowForTasksYaml('minimal')).toBe('minimal')
  })
})

describe('sanitizeTasksYamlForTakt', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true })
      workspace = ''
    }
  })

  it('removes execution_profile from task rows for takt compatibility', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sanitize-tasks-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: task-abc
    status: pending
    workflow: .orbit/workflows/default.yaml
    execution_profile:
      provider: anthropic
      model: claude
`,
      'utf8',
    )

    const changed = await sanitizeTasksYamlForTakt(workspace, DEFAULT_CONFIG)
    expect(changed).toBe(true)

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<{ name: string; execution_profile?: unknown }>
    }
    expect(root.tasks[0].execution_profile).toBeUndefined()
  })

  it('deduplicates task rows by name for bundled takt validation', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sanitize-dedupe-'))
    await mkdir(join(workspace, '.takt', 'tasks', 'old'), { recursive: true })
    await mkdir(join(workspace, '.takt', 'tasks', 'new'), { recursive: true })
    await writeFile(join(workspace, '.takt', 'tasks', 'old', 'order.md'), 'old\n', 'utf8')
    await writeFile(join(workspace, '.takt', 'tasks', 'new', 'order.md'), 'new\n', 'utf8')
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: dup
    status: pending
    task_dir: .takt/tasks/old
  - name: dup
    status: pending
    task_dir: .takt/tasks/new
`,
      'utf8',
    )

    const changed = await sanitizeTasksYamlForTakt(workspace, DEFAULT_CONFIG)
    expect(changed).toBe(true)

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<{ name: string; task_dir?: string }>
    }
    expect(root.tasks).toHaveLength(1)
    expect(root.tasks[0]?.name).toBe('dup')
    expect(root.tasks[0]?.task_dir).toBe('.takt/tasks/new')
    await expect(access(join(workspace, '.takt', 'tasks', 'old'))).rejects.toThrow()
    await expect(access(join(workspace, '.takt', 'tasks', 'new'))).resolves.toBeUndefined()
  })

  it('removes null branch/worktree/issue and normalizes workflow paths', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sanitize-nulls-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: t1
    status: pending
    task_dir: .takt/tasks/20260526-000000-t1
    workflow: .orbit/runtime-workflows/default.yaml
    created_at: 2026-05-26T00:00:00.000Z
    started_at: null
    completed_at: null
    branch: null
    worktree: null
    issue: null
`,
      'utf8',
    )

    const changed = await sanitizeTasksYamlForTakt(workspace, DEFAULT_CONFIG)
    expect(changed).toBe(true)

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    expect(root.tasks[0]?.workflow).toBe('default')
    expect(root.tasks[0]).not.toHaveProperty('branch')
    expect(root.tasks[0]).not.toHaveProperty('worktree')
    expect(root.tasks[0]).not.toHaveProperty('issue')
  })

  it('returns false when no unsupported fields exist', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sanitize-clean-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(tasksYamlPath, 'tasks:\n  - name: t1\n    status: pending\n', 'utf8')

    const changed = await sanitizeTasksYamlForTakt(workspace, DEFAULT_CONFIG)
    expect(changed).toBe(false)
  })

  it('removes invalid base_branch values for takt execution', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sanitize-base-branch-'))
    await mkdir(join(workspace, '.takt'), { recursive: true })
    const tasksYamlPath = join(workspace, '.takt', 'tasks.yaml')
    await writeFile(
      tasksYamlPath,
      `tasks:
  - name: detached-head
    status: pending
    base_branch: HEAD
  - name: remote-tracking
    status: pending
    base_branch: origin/develop
  - name: empty-base
    status: pending
    base_branch: "  "
  - name: valid
    status: pending
    base_branch: develop
`,
      'utf8',
    )

    const changed = await sanitizeTasksYamlForTakt(workspace, DEFAULT_CONFIG)
    expect(changed).toBe(true)

    const root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as {
      tasks: Array<Record<string, unknown>>
    }
    const byName = Object.fromEntries(root.tasks.map((row) => [row.name, row]))
    expect(byName['detached-head']).not.toHaveProperty('base_branch')
    expect(byName['remote-tracking']).not.toHaveProperty('base_branch')
    expect(byName['empty-base']).not.toHaveProperty('base_branch')
    expect(byName.valid).toMatchObject({ base_branch: 'develop' })
  })
})
