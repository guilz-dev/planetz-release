import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openTaskResultPath, resolveReportAbsPath } from '../lib/task-result-path-open.js'

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn(async () => ''),
  },
}))

import { shell } from 'electron'

const config = DEFAULT_CONFIG
const fixtures: string[] = []

afterEach(() => {
  vi.clearAllMocks()
  fixtures.length = 0
})

async function writeFixture(options: {
  runSlug: string
  taskId?: string
  summary?: string
  includeRunSlug?: boolean
}): Promise<string> {
  const base = join(
    tmpdir(),
    `planetz-task-result-path-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  const runSlug = options.runSlug
  const taskId = options.taskId ?? 'task-alpha'
  const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
  await mkdir(reportsDir, { recursive: true })
  if (options.summary) {
    await writeFile(join(reportsDir, 'summary.md'), options.summary, 'utf8')
  }
  await mkdir(join(base, '.takt'), { recursive: true })
  const runSlugLine = options.includeRunSlug === false ? '' : `    run_slug: ${runSlug}\n`
  await writeFile(
    join(base, '.takt', 'tasks.yaml'),
    `tasks:
  - name: ${taskId}
${runSlugLine}    status: completed
`,
    'utf8',
  )
  fixtures.push(base)
  return base
}

describe('resolveReportAbsPath', () => {
  it('strips reports/ prefix and joins under reportsDir', () => {
    expect(resolveReportAbsPath('/tmp/runs/foo/reports', 'reports/summary.md')).toBe(
      '/tmp/runs/foo/reports/summary.md',
    )
  })

  it('rejects path traversal', () => {
    expect(resolveReportAbsPath('/tmp/runs/foo/reports', '../secret.md')).toBeNull()
  })
})

describe('openTaskResultPath', () => {
  it('opens a report file under the resolved reports directory', async () => {
    const taktRepo = await writeFixture({
      runSlug: 'run-test-001',
      summary: '# Summary\n',
    })

    const result = await openTaskResultPath({
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId: 'task-alpha',
      action: 'open_report',
      relativePath: 'reports/summary.md',
      readWorkflowYaml: async () => null,
    })

    expect(result.status).toBe('opened')
    expect(shell.openPath).toHaveBeenCalledWith(
      join(taktRepo, '.takt', 'runs', 'run-test-001', 'reports', 'summary.md'),
    )
  })

  it('reveals the reports directory', async () => {
    const taktRepo = await writeFixture({
      runSlug: 'run-test-001',
      summary: '# Summary\n',
    })

    const result = await openTaskResultPath({
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId: 'task-alpha',
      action: 'reveal_reports_dir',
      readWorkflowYaml: async () => null,
    })

    expect(result.status).toBe('opened')
    expect(shell.openPath).toHaveBeenCalledWith(
      join(taktRepo, '.takt', 'runs', 'run-test-001', 'reports'),
    )
  })

  it('returns not_found when task has no reports', async () => {
    const taktRepo = await writeFixture({
      runSlug: 'run-test-001',
      includeRunSlug: false,
    })

    const result = await openTaskResultPath({
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId: 'task-alpha',
      action: 'reveal_reports_dir',
      readWorkflowYaml: async () => null,
    })

    expect(result.status).toBe('not_found')
    expect(shell.openPath).not.toHaveBeenCalled()
  })
})
