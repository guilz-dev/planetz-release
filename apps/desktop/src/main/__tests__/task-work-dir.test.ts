import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  openTaskWorkDir,
  resolveAllowedWorkDirRoots,
  resolveTaskClonePath,
  resolveTaskOpenPath,
  resolveTaskWorkDirAbsPath,
  resolveTaskWorkDirFromYaml,
} from '../lib/task-work-dir.js'

const config = {
  ...DEFAULT_CONFIG,
  tasksYamlPath: '.takt/tasks.yaml',
}

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn(async () => ''),
  },
}))

describe('task-work-dir', () => {
  const dirs: string[] = []

  afterEach(() => {
    vi.clearAllMocks()
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    dirs.length = 0
  })

  function seedRepo(layout: { taktRepo: string; workspace?: string; tasksYaml: string }): {
    taktRepo: string
    workspace: string
  } {
    const workspace = layout.workspace ?? layout.taktRepo
    dirs.push(layout.taktRepo)
    if (workspace !== layout.taktRepo) dirs.push(workspace)
    mkdirSync(join(layout.taktRepo, '.takt'), { recursive: true })
    writeFileSync(join(layout.taktRepo, '.takt', 'tasks.yaml'), layout.tasksYaml, 'utf8')
    return { taktRepo: layout.taktRepo, workspace }
  }

  it('resolveTaskOpenPath prefers worktree_path then task_dir', () => {
    const taktRepo = '/repo/isolated'
    expect(
      resolveTaskOpenPath(taktRepo, {
        worktree_path: '/repo/takt-worktrees/wt-1',
        task_dir: '.takt/tasks/pkg',
      }),
    ).toBe('/repo/takt-worktrees/wt-1')
    expect(resolveTaskOpenPath(taktRepo, { task_dir: '.takt/tasks/pkg' })).toBe(
      '/repo/isolated/.takt/tasks/pkg',
    )
    expect(resolveTaskOpenPath(taktRepo, {})).toBeNull()
  })

  it('resolveTaskClonePath prefers worktree_path then isolated repo root', () => {
    const taktRepo = '/repo/isolated'
    expect(
      resolveTaskClonePath(taktRepo, {
        worktree_path: '/repo/takt-worktrees/wt-1',
        task_dir: '.takt/tasks/pkg',
      }),
    ).toBe('/repo/takt-worktrees/wt-1')
    expect(resolveTaskClonePath(taktRepo, { task_dir: '.takt/tasks/pkg' })).toBe('/repo/isolated')
    expect(resolveTaskWorkDirAbsPath(taktRepo, { task_dir: '.takt/tasks/pkg' })).toBe(
      '/repo/isolated',
    )
  })

  it('openTaskWorkDir opens task package when only task_dir is set', async () => {
    const { shell } = await import('electron')
    const taktRepo = mkdtempSync(join(tmpdir(), 'planetz-task-work-dir-root-'))
    const taskDir = join(taktRepo, '.takt', 'tasks', 'pkg')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(join(taskDir, 'order.md'), 'issue body\n', 'utf8')
    const { taktRepo: repo, workspace } = seedRepo({
      taktRepo,
      tasksYaml: `tasks:
  - name: task-in-place
    task_dir: .takt/tasks/pkg
`,
    })

    const result = await openTaskWorkDir({
      taktRepoPath: repo,
      workspacePath: workspace,
      config,
      taskId: 'task-in-place',
    })

    expect(result.status).toBe('opened')
    if (result.status !== 'opened') throw new Error('expected opened')
    expect(result.path).toBe(taskDir)
    expect(shell.openPath).toHaveBeenCalledWith(taskDir)
  })

  it('resolveTaskWorkDirFromYaml uses clone purpose by default', async () => {
    const taktRepo = mkdtempSync(join(tmpdir(), 'planetz-task-work-dir-'))
    const worktree = join(taktRepo, '..', 'takt-worktrees', 'wt-a')
    mkdirSync(worktree, { recursive: true })
    seedRepo({
      taktRepo,
      tasksYaml: `tasks:
  - name: task-a
    worktree_path: ${worktree}
`,
    })
    const path = await resolveTaskWorkDirFromYaml(taktRepo, config, 'task-a')
    expect(path).toContain('takt-worktrees')
    expect(path).toContain('wt-a')
  })

  it('resolveTaskWorkDirFromYaml open purpose resolves task_dir not repo root', async () => {
    const taktRepo = mkdtempSync(join(tmpdir(), 'planetz-task-work-dir-open-'))
    const taskDirRel = '.takt/tasks/pkg'
    seedRepo({
      taktRepo,
      tasksYaml: `tasks:
  - name: task-open-dir
    task_dir: ${taskDirRel}
    branch: takt/demo
`,
    })
    const openPath = await resolveTaskWorkDirFromYaml(taktRepo, config, 'task-open-dir', 'open')
    const clonePath = await resolveTaskWorkDirFromYaml(taktRepo, config, 'task-open-dir', 'clone')
    expect(openPath).toBe(join(taktRepo, taskDirRel))
    expect(clonePath).toBe(taktRepo)
  })

  it('openTaskWorkDir opens path under takt-worktrees', async () => {
    const { shell } = await import('electron')
    const taktRepo = mkdtempSync(join(tmpdir(), 'planetz-task-work-dir-repo-'))
    const worktree = join(taktRepo, '..', 'takt-worktrees', 'wt-open')
    mkdirSync(worktree, { recursive: true })
    const { taktRepo: repo, workspace } = seedRepo({
      taktRepo,
      tasksYaml: `tasks:
  - name: task-open
    worktree_path: ${worktree}
`,
    })

    const result = await openTaskWorkDir({
      taktRepoPath: repo,
      workspacePath: workspace,
      config,
      taskId: 'task-open',
    })

    expect(result.status).toBe('opened')
    expect(shell.openPath).toHaveBeenCalledWith(worktree)
  })

  it('openTaskWorkDir denies paths outside allowed roots', async () => {
    const taktRepo = mkdtempSync(join(tmpdir(), 'planetz-task-work-dir-deny-'))
    seedRepo({
      taktRepo,
      tasksYaml: `tasks:
  - name: task-evil
    worktree_path: /tmp/outside-allowed-root
`,
    })

    const result = await openTaskWorkDir({
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId: 'task-evil',
    })

    expect(result.status).toBe('denied')
  })

  it('resolveAllowedWorkDirRoots includes isolated repo and takt-worktrees parent', () => {
    const roots = resolveAllowedWorkDirRoots('/ws/.planetz/isolated', '/ws/project')
    expect(roots).toContain('/ws/.planetz/isolated')
    expect(roots).toContain('/ws/.planetz/takt-worktrees')
    expect(roots).toContain('/ws/project')
  })
})
