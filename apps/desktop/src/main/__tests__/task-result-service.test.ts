import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTaskResultBundle } from '../lib/task-result-service.js'
import { BUILTIN_MINIMAL_WORKFLOW_YAML } from '../takt/builtin-workflow-yaml.js'

const config = DEFAULT_CONFIG

async function writeFixture(root: {
  summary: string
  runSlug?: string
  taskId?: string
  workflow?: string
}): Promise<string> {
  const base = join(
    tmpdir(),
    `planetz-task-result-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  const runSlug = root.runSlug ?? 'run-test-001'
  const taskId = root.taskId ?? 'task-alpha'
  const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
  await mkdir(reportsDir, { recursive: true })
  await writeFile(join(reportsDir, 'summary.md'), root.summary, 'utf8')
  await mkdir(join(base, '.takt'), { recursive: true })
  await writeFile(
    join(base, '.takt', 'tasks.yaml'),
    `tasks:
  - name: ${taskId}
    run_slug: ${runSlug}
    workflow: ${root.workflow ?? 'minimal'}
    status: completed
`,
    'utf8',
  )
  return base
}

const fixtures: string[] = []

afterEach(() => {
  fixtures.length = 0
})

describe('resolveTaskResultBundle', () => {
  it('returns ok with summary as primary report', async () => {
    const taktRepo = await writeFixture({
      summary: '# Summary\n\nGit is available on this branch.',
    })
    fixtures.push(taktRepo)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId: 'task-alpha',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.runsDirRel).toBe(config.runsDir)
    expect(bundle.reports).toHaveLength(1)
    expect(bundle.reports[0]?.formatKey).toBe('summary')
    expect(bundle.primaryIndex).toBe(0)
    expect(bundle.reports[0]?.content).toContain('Git is available')
  })

  it('returns no_run when run directory is missing', async () => {
    const base = join(tmpdir(), `planetz-task-result-norun-${Date.now()}`)
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: missing-run
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'missing-run',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('no_run')
    expect(bundle.errorCode).toBeUndefined()
  })

  it('returns no_reports when run exists but reports are empty', async () => {
    const base = join(tmpdir(), `planetz-task-result-norep-${Date.now()}`)
    const runSlug = 'run-empty-reports'
    await mkdir(join(base, '.takt', 'runs', runSlug, 'reports'), { recursive: true })
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: empty-reports
    run_slug: ${runSlug}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'empty-reports',
      readWorkflowYaml: async () => 'name: minimal\nsteps:\n  - name: implement\n',
    })

    expect(bundle.status).toBe('no_reports')
    expect(bundle.runDirSlug).toBe(runSlug)
    expect(bundle.noReportsReason).toBe('workflow_output_not_configured')
  })

  it('resolves reports from worktree_path when run_slug is set', async () => {
    const base = join(tmpdir(), `planetz-task-result-wt-${Date.now()}`)
    const runSlug = 'run-worktree'
    const worktree = join(base, 'wt-task')
    const reportsDir = join(worktree, '.takt', 'runs', runSlug, 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'summary.md'), '# Worktree summary\n\nFrom worktree.', 'utf8')
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: wt-task
    run_slug: ${runSlug}
    worktree_path: ${worktree}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'wt-task',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports[0]?.content).toContain('From worktree')
  })

  it('reads nested report files under reports/subdirs', async () => {
    const base = join(tmpdir(), `planetz-task-result-nested-${Date.now()}`)
    const runSlug = 'run-nested'
    const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports', 'subworkflows', 'step-a')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'summary.md'), '# Nested\n\nFrom subfolder.', 'utf8')
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: nested-task
    run_slug: ${runSlug}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'nested-task',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports).toHaveLength(1)
    expect(bundle.reports[0]?.fileName).toBe('subworkflows/step-a/summary.md')
    expect(bundle.reports[0]?.content).toContain('From subfolder')
  })

  it('returns ok when some report paths are unreadable but others load', async () => {
    const base = join(tmpdir(), `planetz-task-result-partial-${Date.now()}`)
    const runSlug = 'run-partial-read'
    const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'summary.md'), '# Readable\n\nOK.', 'utf8')
    await mkdir(join(reportsDir, 'broken.md'), { recursive: true })
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: partial-read
    run_slug: ${runSlug}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'partial-read',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports).toHaveLength(1)
    expect(bundle.reports[0]?.content).toContain('Readable')
  })

  it('merges summary from main run when worktree run only has plan', async () => {
    const base = join(tmpdir(), `planetz-task-result-wt-merge-${Date.now()}`)
    const runSlug = 'run-wt-merge'
    const worktreeRel = 'takt-worktrees/wt-merge'
    const wtReportsDir = join(base, worktreeRel, '.takt', 'runs', runSlug, 'reports')
    const mainReportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
    await mkdir(wtReportsDir, { recursive: true })
    await mkdir(mainReportsDir, { recursive: true })
    await writeFile(join(wtReportsDir, 'plan.md'), '# Plan\n\nWorktree plan only.', 'utf8')
    await writeFile(join(mainReportsDir, 'plan.md'), '# Plan\n\nMain plan.', 'utf8')
    await writeFile(
      join(mainReportsDir, 'summary.md'),
      '# Summary\n\nFinal answer from main run.',
      'utf8',
    )
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: wt-merge-task
    run_slug: ${runSlug}
    worktree_path: ${worktreeRel}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'wt-merge-task',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports).toHaveLength(2)
    const summaryIndex = bundle.reports.findIndex((r) => r.fileName.endsWith('summary.md'))
    expect(summaryIndex).toBeGreaterThanOrEqual(0)
    expect(bundle.primaryIndex).toBe(summaryIndex)
    expect(bundle.reports[summaryIndex]?.content).toContain('Final answer from main run')
  })

  it('resolves reports when worktree_path is relative to the takt repo', async () => {
    const base = join(tmpdir(), `planetz-task-result-rel-wt-${Date.now()}`)
    const runSlug = 'run-rel-wt'
    const worktreeRel = 'takt-worktrees/wt-rel'
    const reportsDir = join(base, worktreeRel, '.takt', 'runs', runSlug, 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'summary.md'), '# Relative worktree\n\nResolved.', 'utf8')
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: rel-wt-task
    run_slug: ${runSlug}
    worktree_path: ${worktreeRel}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'rel-wt-task',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports[0]?.content).toContain('Relative worktree')
  })

  it('prefers summary over analysis when analysis is the last workflow step contract', async () => {
    const base = join(tmpdir(), `planetz-task-result-analysis-${Date.now()}`)
    const runSlug = 'run-analysis-vs-summary'
    const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'analysis.md'), '# Analysis\n\nPlanning only.', 'utf8')
    await writeFile(join(reportsDir, 'summary.md'), '# Summary\n\nImplementation finished.', 'utf8')
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: analysis-vs-summary
    run_slug: ${runSlug}
    workflow: custom
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const workflowYaml = `name: custom
steps:
  - name: implement
    output_contracts:
      markdown:
        - format: summary
  - name: analyze
    output_contracts:
      markdown:
        - format: analysis
`

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'analysis-vs-summary',
      readWorkflowYaml: async () => workflowYaml,
    })

    expect(bundle.status).toBe('ok')
    expect(bundle.reports).toHaveLength(2)
    const summaryIndex = bundle.reports.findIndex((r) => r.fileName.endsWith('summary.md'))
    expect(summaryIndex).toBeGreaterThanOrEqual(0)
    expect(bundle.primaryIndex).toBe(summaryIndex)
    expect(bundle.reports[summaryIndex]?.content).toContain('Implementation finished')
  })

  it('returns external when executor is external and no reports exist', async () => {
    const base = join(tmpdir(), `planetz-task-result-ext-${Date.now()}`)
    const runSlug = 'run-empty'
    await mkdir(join(base, '.takt', 'runs', runSlug, 'reports'), { recursive: true })
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: ext-task
    run_slug: ${runSlug}
    workflow: minimal
    status: completed
`,
      'utf8',
    )
    fixtures.push(base)

    const bundle = await resolveTaskResultBundle({
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId: 'ext-task',
      assignedAgentId: 'agent-external-cursor',
      readWorkflowYaml: async () => BUILTIN_MINIMAL_WORKFLOW_YAML,
    })

    expect(bundle.status).toBe('external')
    expect(bundle.errorCode).toBeUndefined()
  })
})
