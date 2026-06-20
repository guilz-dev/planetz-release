import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentOverridesStore } from '../../planetz/agent-overrides-store.js'
import { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

describe('canonical workflow write guard', () => {
  let workspace: string
  let sidecar: string

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it(
    'writeProjectWorkflow updates sidecar only, not .takt/workflows',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'planetz-guard-'))
      sidecar = join(workspace, SIDECAR_DIR_NAME)
      const taktDir = join(workspace, '.takt', 'workflows')
      await mkdir(sidecar, { recursive: true })
      await mkdir(taktDir, { recursive: true })
      const taktPath = join(taktDir, 'guard-test.yaml')
      await writeFile(
        taktPath,
        'name: guard-test\nsteps:\n  - name: plan\n    persona: planner\n',
        'utf8',
      )
      const taktBefore = await readFile(taktPath, 'utf8')

      const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }
      const paths = mockSidecarPaths(sidecar)
      const mgr = new PlanetzWorkflowCanonicalManager(workspace, config, paths)
      const yaml = `name: guard-test
steps:
  - name: implement
    persona: coder
    instruction: implement
`
      await mgr.writeProject('guard-test', yaml)

      const planetzYaml = await readFile(join(paths.planetzWorkflowsDir, 'guard-test.yaml'), 'utf8')
      expect(planetzYaml).toContain('name: guard-test')

      const taktYaml = await readFile(taktPath, 'utf8')
      expect(taktYaml).toBe(taktBefore)
      expect(taktYaml).toContain('persona: planner')
      expect(taktYaml).not.toContain('persona: coder')

      await expect(
        access(join(workspace, '.takt', 'workflows', 'guard-test.yaml')),
      ).resolves.toBeUndefined()
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('agent overrides store writes only under sidecar agents path', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-agent-guard-'))
    sidecar = join(workspace, SIDECAR_DIR_NAME)
    await mkdir(sidecar, { recursive: true })
    const paths = mockSidecarPaths(sidecar)
    const store = new AgentOverridesStore()
    await store.save(paths, {
      persona_providers: { coder: { provider: 'anthropic', model: 'claude' } },
    })

    const yaml = await readFile(paths.agentOverridesPath, 'utf8')
    expect(yaml).toContain('persona_providers')
    await expect(access(join(workspace, '.takt', 'agents', 'overrides.yaml'))).rejects.toThrow()
  })

  it('writeProjectFacet stores under sidecar facets not main .takt/facets', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-facet-guard-'))
    await mkdir(join(workspace, SIDECAR_DIR_NAME), { recursive: true })
    const { writeProjectFacet } = await import('../../takt/facet-resolver.js')
    await writeProjectFacet(workspace, DEFAULT_CONFIG, 'personas', 'guard-facet', '# Guard\n')
    await expect(
      access(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'guard-facet.md')),
    ).resolves.toBeUndefined()
    await expect(
      access(join(workspace, '.takt', 'facets', 'personas', 'guard-facet.md')),
    ).rejects.toBeDefined()
  })

  it(
    'readCanonicalYaml returns null when workflow exists only under .takt',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'planetz-canonical-read-'))
      sidecar = join(workspace, SIDECAR_DIR_NAME)
      const taktDir = join(workspace, '.takt', 'workflows')
      await mkdir(sidecar, { recursive: true })
      await mkdir(taktDir, { recursive: true })
      await writeFile(
        join(taktDir, 'takt-only.yaml'),
        'name: takt-only\nprovider: takt-layer\nsteps: []\n',
        'utf8',
      )

      const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }
      const paths = mockSidecarPaths(sidecar)
      const mgr = new PlanetzWorkflowCanonicalManager(workspace, config, paths, workspace)

      expect(await mgr.readCanonicalYaml('takt-only')).toBeNull()
      const display = await mgr.read('takt-only')
      expect(display.yaml).toContain('provider: takt-layer')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )
})
