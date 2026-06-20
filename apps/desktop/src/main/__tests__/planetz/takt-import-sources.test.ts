import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listTaktWorkflowImportCandidates,
  resolveTaktWorkflowYaml,
} from '../../planetz/takt-import-sources.js'

describe('resolveTaktWorkflowYaml precedence', () => {
  let workspace: string
  let taktRepo: string

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    if (taktRepo && taktRepo !== workspace) {
      await rm(taktRepo, { recursive: true, force: true })
    }
  })

  it('prefers sidecar workflows over isolated project .takt and builtin', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-'))
    taktRepo = await mkdtemp(join(tmpdir(), 'planetz-takt-repo-'))
    const canonical = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    const project = join(taktRepo, '.takt', 'workflows')
    await mkdir(canonical, { recursive: true })
    await mkdir(project, { recursive: true })
    await writeFile(
      join(canonical, 'precedence-test.yaml'),
      'name: precedence-test\nsteps:\n  - name: plan\n    persona: orbit\n',
      'utf8',
    )
    await writeFile(
      join(project, 'precedence-test.yaml'),
      'name: precedence-test\nsteps:\n  - name: plan\n    persona: project\n',
      'utf8',
    )

    const resolved = await resolveTaktWorkflowYaml(workspace, DEFAULT_CONFIG, 'precedence-test', {
      taktRepoPath: taktRepo,
    })
    expect(resolved?.layer).toBe('orbit')
    expect(resolved?.yaml).toContain('persona: orbit')
  })

  it('falls back to isolated project workflows when canonical is missing', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-main-'))
    taktRepo = await mkdtemp(join(tmpdir(), 'planetz-ws-takt-'))
    const project = join(taktRepo, '.takt', 'workflows')
    await mkdir(project, { recursive: true })
    await writeFile(
      join(project, 'project-only.yaml'),
      'name: project-only\nsteps:\n  - name: plan\n    persona: project\n',
      'utf8',
    )

    const resolved = await resolveTaktWorkflowYaml(workspace, DEFAULT_CONFIG, 'project-only', {
      taktRepoPath: taktRepo,
    })
    expect(resolved?.layer).toBe('project')
    expect(resolved?.yaml).toContain('persona: project')
  })

  it('lists project workflows from taktRepoPath only', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-list-'))
    taktRepo = await mkdtemp(join(tmpdir(), 'planetz-ws-list-takt-'))
    const legacy = join(taktRepo, '.takt', 'workflows')
    await mkdir(legacy, { recursive: true })
    await writeFile(
      join(legacy, 'legacy-only.yaml'),
      'name: legacy-only\nsteps:\n  - name: plan\n    persona: legacy\n',
      'utf8',
    )

    const listed = await listTaktWorkflowImportCandidates(workspace, DEFAULT_CONFIG, undefined, {
      taktRepoPath: taktRepo,
    })
    expect(listed.some((c) => c.name === 'legacy-only')).toBe(true)
  })

  it('does not scan main .takt/workflows without taktRepoPath', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-main-only-'))
    taktRepo = workspace
    const legacy = join(workspace, '.takt', 'workflows')
    await mkdir(legacy, { recursive: true })
    await writeFile(
      join(legacy, 'main-takt-only.yaml'),
      'name: main-takt-only\nsteps:\n  - name: plan\n    persona: legacy\n',
      'utf8',
    )

    const listed = await listTaktWorkflowImportCandidates(workspace, DEFAULT_CONFIG)
    expect(listed.some((c) => c.name === 'main-takt-only')).toBe(false)
  })

  it('prefers sidecar workflows when listing a named workflow', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-layers-'))
    taktRepo = workspace
    const canonical = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(canonical, { recursive: true })
    await writeFile(
      join(canonical, 'layer-test.yaml'),
      'name: layer-test\nsteps:\n  - name: plan\n    persona: canonical\n',
      'utf8',
    )

    const resolved = await resolveTaktWorkflowYaml(workspace, DEFAULT_CONFIG, 'layer-test')
    expect(resolved?.layer).toBe('orbit')
    expect(resolved?.yaml).toContain('persona: canonical')

    const listed = await listTaktWorkflowImportCandidates(workspace, DEFAULT_CONFIG, 'layer-test')
    expect(listed[0]?.layer).toBe('orbit')
    expect(listed[0]?.yaml).toContain('persona: canonical')
  })
})
