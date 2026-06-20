import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskCatalog } from '../session/task-catalog.js'

const config = {
  tasksYamlPath: '.takt/tasks.yaml',
  runsDir: '.takt/runs',
} as UiConfig

describe('TaskCatalog', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    dirs.length = 0
    vi.restoreAllMocks()
  })

  function seedWorkspace(tasksYaml: string): string {
    const root = mkdtempSync(join(tmpdir(), 'planetz-task-catalog-'))
    dirs.push(root)
    mkdirSync(join(root, '.takt'), { recursive: true })
    writeFileSync(join(root, '.takt', 'tasks.yaml'), tasksYaml, 'utf8')
    return root
  }

  it('reloads tasks when the workspace path changes', async () => {
    const catalog = new TaskCatalog()
    const wsA = seedWorkspace('tasks:\n  - name: task-a\n    status: pending\n')
    const wsB = seedWorkspace('tasks:\n  - name: task-b\n    status: running\n')

    const first = await catalog.loadCached(wsA, config)
    expect(first.map((t) => t.id)).toEqual(['task-a'])

    const second = await catalog.loadCached(wsB, config)
    expect(second.map((t) => t.id)).toEqual(['task-b'])
  })

  it('readFresh re-reads tasks.yaml without updating the refresh cache', async () => {
    const catalog = new TaskCatalog()
    const ws = seedWorkspace('tasks:\n  - name: task-a\n    status: pending\n')
    const cached = await catalog.loadCached(ws, config)
    expect(cached[0]?.status).toBe('pending')

    writeFileSync(
      join(ws, '.takt', 'tasks.yaml'),
      'tasks:\n  - name: task-a\n    status: running\n',
      'utf8',
    )
    const fresh = await catalog.readFresh(ws, config)
    expect(fresh[0]?.status).toBe('running')

    const stillCached = await catalog.loadCached(ws, config)
    expect(stillCached[0]?.status).toBe('pending')
  })
})
