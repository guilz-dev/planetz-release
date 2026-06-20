import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatRunId, type UiConfig } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { readTaskRunEventSources, readTasksFromYaml } from '../lib/tasks-yaml-reader.js'

const config = {
  tasksYamlPath: '.takt/tasks.yaml',
  runsDir: '.takt/runs',
} as UiConfig

describe('readTasksFromYaml', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    dirs.length = 0
  })

  function seedWorkspace(tasksYaml: string): string {
    const root = mkdtempSync(join(tmpdir(), 'planetz-tasks-yaml-reader-'))
    dirs.push(root)
    mkdirSync(join(root, '.takt'), { recursive: true })
    writeFileSync(join(root, '.takt', 'tasks.yaml'), tasksYaml, 'utf8')
    return root
  }

  function writeOrderMd(workspace: string, taskDir: string, body: string): void {
    const absTaskDir = join(workspace, taskDir)
    mkdirSync(absTaskDir, { recursive: true })
    writeFileSync(join(absTaskDir, 'order.md'), body, 'utf8')
  }

  it('maps tasks.yaml failure.error into TaskFailure metadata', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: task-failed
    status: failed
    task_dir: .takt/tasks/20260527-101738-issue-15
    created_at: 2026-05-27T10:17:38.684Z
    started_at: 2026-05-27T10:17:39.535Z
    completed_at: 2026-05-27T10:17:39.553Z
    failure:
      error: "Invalid base branch: HEAD"
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.failure).toEqual({
      failedAt: '2026-05-27T10:17:39.553Z',
      message: 'Invalid base branch: HEAD',
      runId: formatRunId('20260527-101738-issue-15', 'task-state'),
      kind: 'failed',
    })
  })

  it('keeps failure undefined when tasks.yaml has no failure.error', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: task-failed
    status: failed
    created_at: 2026-05-27T10:17:38.684Z
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.failure).toBeUndefined()
  })

  it('uses the first line of order.md as title', async () => {
    const taskDir = '.takt/tasks/20260527-101738-issue-18wo-shite'
    const workspace = seedWorkspace(`tasks:
  - name: issue-18wo-shite
    status: pending
    task_dir: ${taskDir}
`)
    writeOrderMd(workspace, taskDir, 'issue #18を実装して\nこの行は本文として扱う')

    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.id).toBe('issue-18wo-shite')
    expect(tasks[0]?.title).toBe('issue #18を実装して')
  })

  it('truncates order.md first-line title to storage limit', async () => {
    const taskDir = '.takt/tasks/20260527-101738-long'
    const workspace = seedWorkspace(`tasks:
  - name: long-fallback
    status: pending
    task_dir: ${taskDir}
`)
    const longLine = 'x'.repeat(120)
    writeOrderMd(workspace, taskDir, `${longLine}\nbody`)

    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.title).toBe('x'.repeat(80))
  })

  it('coerces numeric completed_at for updatedAt', async () => {
    const completedSeconds = Math.floor(Date.UTC(2026, 4, 27, 10, 17, 39) / 1000)
    const workspace = seedWorkspace(`tasks:
  - name: task-done
    status: completed
    created_at: 2020-01-01T00:00:00.000Z
    completed_at: ${completedSeconds}
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.updatedAt).toBe(new Date(completedSeconds * 1000).toISOString())
  })

  it('maps pr_failed to failed with statusReason and failure metadata', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: goal-task
    status: pr_failed
    task_dir: .takt/tasks/20260527-143456-goal
    created_at: 2026-05-27T14:34:56.082Z
    completed_at: 2026-05-27T14:51:44.337Z
    failure:
      error: "PR creation failed: gh host unknown"
      step: peer-review
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.status).toBe('failed')
    expect(tasks[0]?.rawStatus).toBe('pr_failed')
    expect(tasks[0]?.statusReason).toBe('pr_failed')
    expect(tasks[0]?.errorKind).toBe('pr_creation')
    expect(tasks[0]?.failure?.message).toBe('PR creation failed: gh host unknown')
    expect(tasks[0]?.failure?.failedStep).toBe('peer-review')
  })

  it('maps unknown yaml status to failed instead of pending', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: odd-task
    status: mystery_status
    created_at: 2026-05-27T10:00:00.000Z
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.status).toBe('failed')
    expect(tasks[0]?.statusReason).toBe('unknown_status')
    expect(tasks[0]?.rawStatus).toBe('mystery_status')
  })

  it('treats interrupted and aborted yaml statuses as terminal failed tasks', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: interrupted-task
    status: interrupted
    started_at: 2026-05-27T10:17:39.535Z
    completed_at: 2026-05-27T10:17:40.553Z
  - name: aborted-task
    status: aborted
    completed_at: 2026-05-27T10:18:44.337Z
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]).toMatchObject({
      id: 'interrupted-task',
      status: 'failed',
      rawStatus: 'interrupted',
      statusReason: 'interrupted',
    })
    expect(tasks[1]).toMatchObject({
      id: 'aborted-task',
      status: 'failed',
      rawStatus: 'aborted',
      statusReason: 'workflow_aborted',
    })
  })

  it('treats cancelled yaml status as explicit stopped state', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: cancelled-task
    status: cancelled
    completed_at: 2026-05-27T10:18:44.337Z
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]).toMatchObject({
      id: 'cancelled-task',
      status: 'stopped',
      rawStatus: 'cancelled',
      statusReason: 'stopped',
    })
  })

  it('uses failure.last_message when error is absent', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: task-failed
    status: failed
    created_at: 2026-05-27T10:17:38.684Z
    failure:
      last_message: "Last agent message"
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.failure?.message).toBe('Last agent message')
  })

  it('maps task_dir-only rows to task package as workDirPath', async () => {
    const taskDir = '.takt/tasks/20260527-101738-issue-only-dir'
    const workspace = seedWorkspace(`tasks:
  - name: issue-only-dir
    status: completed
    task_dir: ${taskDir}
`)
    writeOrderMd(workspace, taskDir, 'issue body')

    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.workDirPath).toBe(join(workspace, taskDir))
  })

  it('maps worktree_path to workDirPath on TaskViewModel', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: task-wt
    status: completed
    worktree_path: /tmp/takt-worktrees/demo-wt
    branch: takt/demo
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.workDirPath).toBe('/tmp/takt-worktrees/demo-wt')
    expect(tasks[0]?.sourceBranch).toBe('takt/demo')
  })

  it('maps issue number from tasks.yaml into TaskViewModel', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: task-issue
    status: completed
    issue: 368
`)
    const tasks = await readTasksFromYaml(workspace, config)
    expect(tasks[0]?.issueNumber).toBe(368)
  })

  it('extracts run_dir mapping and worktree run roots', async () => {
    const workspace = seedWorkspace(`tasks:
  - name: issue-14
    run_slug: 20260527-130250-implement-using-only-the-files-yulcfw
    worktree_path: /tmp/takt-worktrees/20260527T1302-issueno14wo-shite
  - name: issue-15
    run_slug: 20260527-140101-something
`)
    const sources = await readTaskRunEventSources(workspace, config)
    expect(
      sources.runDirSlugToTaskId.get('20260527-130250-implement-using-only-the-files-yulcfw'),
    ).toBe('issue-14')
    expect(sources.runDirSlugToTaskId.get('20260527-140101-something')).toBe('issue-15')
    expect(sources.additionalRunRoots).toContain(
      '/tmp/takt-worktrees/20260527T1302-issueno14wo-shite/.takt/runs',
    )
  })
})
