import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  planetzAgentOverridesRelPath,
  planetzEngineConfigRelPath,
  planetzWorkflowRelPath,
} from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openPlanetzYaml } from '../../planetz/yaml-open-service.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn(async () => ''),
  },
}))

describe('openPlanetzYaml', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('returns not_found when engine config is missing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    const result = await openPlanetzYaml(paths, { target: 'engine-config' })
    expect(result.status).toBe('not_found')
    expect(result.path).toBe(planetzEngineConfigRelPath())
  })

  it('opens existing agent overrides file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    await mkdir(join(dir, 'agents'), { recursive: true })
    await writeFile(paths.agentOverridesPath, 'persona_providers: {}\n', 'utf8')

    const result = await openPlanetzYaml(paths, { target: 'agent-overrides' })
    expect(result.status).toBe('opened')
    expect(result.path).toBe(planetzAgentOverridesRelPath())
  })

  it('denies workflow open without workflowName', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    const result = await openPlanetzYaml(paths, { target: 'workflow' })
    expect(result.status).toBe('denied')
  })

  it('denies invalid workflow basenames', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })

    expect((await openPlanetzYaml(paths, { target: 'workflow', workflowName: '..' })).status).toBe(
      'denied',
    )
    expect((await openPlanetzYaml(paths, { target: 'workflow', workflowName: '.' })).status).toBe(
      'denied',
    )
  })

  it('normalizes path segments to a basename under workflows', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(join(paths.planetzWorkflowsDir, 'safe.yaml'), 'name: safe\n', 'utf8')

    const result = await openPlanetzYaml(paths, {
      target: 'workflow',
      workflowName: '../safe',
    })
    expect(result.status).toBe('opened')
    expect(result.path).toBe(planetzWorkflowRelPath('safe'))
  })

  it('opens planetz workflow yaml only', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-yaml-open-'))
    const paths = mockSidecarPaths(dir)
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(join(paths.planetzWorkflowsDir, 'demo.yaml'), 'name: demo\n', 'utf8')

    const result = await openPlanetzYaml(paths, {
      target: 'workflow',
      workflowName: 'demo',
    })
    expect(result.status).toBe('opened')
    const written = await readFile(join(paths.planetzWorkflowsDir, 'demo.yaml'), 'utf8')
    expect(written).toContain('name: demo')
  })
})
