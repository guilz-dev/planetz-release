import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../takt/builtin-workflow-yaml.js'
import { TaktWorkflowManagerFs } from '../takt/workflow-manager-fs.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from './test-timeouts.js'

describe('TaktWorkflowManagerFs.read', { timeout: BUNDLED_CLI_TEST_TIMEOUT_MS }, () => {
  let workspace = ''

  afterEach(async () => {
    const dir = workspace
    workspace = ''
    if (dir) {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })

  it('reads builtin yaml when no project override exists', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    await mkdir(join(workspace, '.takt', 'workflows'), { recursive: true })
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const res = await mgr.read('default', 'builtin')
    expect(res.source).toBe('builtin')
    expect(res.yaml).toBe(BUILTIN_DEFAULT_WORKFLOW_YAML)
  })

  it('allows writing project workflow named default (builtin override)', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    const yaml = BUILTIN_DEFAULT_WORKFLOW_YAML.replace(/^name: default/m, 'name: default')
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const result = await mgr.writeProject('default', yaml)
    expect(result.path).toBe(`${SIDECAR_DIR_NAME}/workflows/default.yaml`)
  })

  it('marks project workflows that override builtin names', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    await writeFile(join(wfDir, 'default.yaml'), 'name: default\nsteps: []\n', 'utf8')
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const items = await mgr.list()
    const projectDefault = items.find((w) => w.source === 'project' && w.name === 'default')
    expect(projectDefault?.isOverridden).toBe(true)
  })

  it('does not mark custom project workflows as overridden', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    await writeFile(
      join(wfDir, 'my-custom.yaml'),
      'name: my-custom\nsteps:\n  - name: plan\n',
      'utf8',
    )
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const items = await mgr.list()
    const custom = items.find((w) => w.source === 'project' && w.name === 'my-custom')
    expect(custom?.isOverridden).toBe(false)
  })

  it('prefers project scope when source is project', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    const custom = 'name: default\nsteps:\n  - name: solo\n    persona: coder\n'
    await writeFile(join(wfDir, 'default.yaml'), custom, 'utf8')
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const res = await mgr.read('default', 'project')
    expect(res.source).toBe('project')
    expect(res.yaml).toBe(custom)
  })

  it('reads project facets via readFacets', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const facetDir = join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas')
    await mkdir(facetDir, { recursive: true })
    await writeFile(join(facetDir, 'local.md'), '# Local persona\n', 'utf8')
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const reads = await mgr.readFacets(['../facets/personas/local.md'])
    expect(reads).toHaveLength(1)
    expect(reads[0].source).toBe('project')
    expect(reads[0].content).toBe('# Local persona\n')
  })

  it(
    'writes facet files under sidecar facets root when provided',
    async () => {
      workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
      const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
      await mkdir(wfDir, { recursive: true })
      const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
      await mgr.writeProject('default', BUILTIN_DEFAULT_WORKFLOW_YAML, {
        'facets/personas/planner.md': '# Planner\n',
      })
      const body = await readFile(
        join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'planner.md'),
        'utf8',
      )
      expect(body).toBe('# Planner\n')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('lists frontend-refactor-mock as builtin with category', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    await mkdir(join(workspace, '.takt', 'workflows'), { recursive: true })
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const items = await mgr.list()
    const mock = items.find((w) => w.name === 'frontend-refactor-mock' && w.source === 'builtin')
    expect(mock).toBeDefined()
    expect(mock?.categories).toContain('🎨 Frontend')
  })

  it('reads frontend-refactor-mock yaml from builtin source', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    await mkdir(join(workspace, '.takt', 'workflows'), { recursive: true })
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const res = await mgr.read('frontend-refactor-mock', 'builtin')
    expect(res.source).toBe('builtin')
    expect(res.yaml).toContain('name: frontend-refactor-mock')
  })

  it('hides overridden builtin when project workflow shares the name', async () => {
    workspace = join(tmpdir(), `planetz-wf-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    await writeFile(
      join(wfDir, 'frontend-refactor-mock.yaml'),
      'name: frontend-refactor-mock\nsteps: []\n',
      'utf8',
    )
    const mgr = new TaktWorkflowManagerFs(workspace, DEFAULT_CONFIG)
    const items = await mgr.list()
    const project = items.find((w) => w.source === 'project' && w.name === 'frontend-refactor-mock')
    expect(project?.isOverridden).toBe(true)
    expect(items.some((w) => w.source === 'builtin' && w.name === 'frontend-refactor-mock')).toBe(
      false,
    )
  })
})
