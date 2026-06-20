import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  SIDECAR_DIR_NAME,
  SPEC_DRIVEN_WORKFLOW_NAME,
  type WorkflowDiagnostic,
} from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureProductBuiltinWorkflows } from '../../planetz/default-workflow-bootstrap.js'
import type { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { readFacetsAtManagedPaths } from '../../takt/facet-resolver.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

function createManagerStub(workspace: string, config = DEFAULT_CONFIG) {
  return {
    invalidateListCache: () => {},
    async readFacets(managedPaths: string[]) {
      return readFacetsAtManagedPaths(workspace, config, managedPaths, {
        mainWorkspacePath: workspace,
      })
    },
    async validate(): Promise<WorkflowDiagnostic[]> {
      return []
    },
  } as unknown as PlanetzWorkflowCanonicalManager
}

describe('ensureProductBuiltinWorkflows', { timeout: BUNDLED_CLI_TEST_TIMEOUT_MS }, () => {
  let workspace = ''

  afterEach(async () => {
    const dir = workspace
    workspace = ''
    if (dir) {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })

  it('creates default, minimal, and chat-investigation workflows when canonical copies are missing', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-default-bootstrap-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(join(workspace, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
    await writeFile(
      join(workspace, DEFAULT_CONFIG.facetsDir, 'personas', 'planner.md'),
      '# Planner\n',
      'utf8',
    )

    const result = await ensureProductBuiltinWorkflows(
      workspace,
      DEFAULT_CONFIG,
      paths,
      createManagerStub(workspace),
    )

    const defaultYaml = await readFile(join(paths.planetzWorkflowsDir, 'default.yaml'), 'utf8')
    const minimalYaml = await readFile(join(paths.planetzWorkflowsDir, 'minimal.yaml'), 'utf8')
    const chatYaml = await readFile(
      join(paths.planetzWorkflowsDir, 'chat-investigation.yaml'),
      'utf8',
    )
    expect(defaultYaml).toContain('name: default')
    expect(minimalYaml).toContain('name: minimal')
    expect(chatYaml).toContain('name: chat-investigation')
    expect(minimalYaml).toContain('name: run')
    expect(result.workflowsCreated).toBe(3)
    expect(result.builtinFacetsCreated).toBeGreaterThan(0)
    expect(result.facetRefs).toBeGreaterThan(0)
    await expect(
      access(join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)),
    ).rejects.toThrow()
  })

  it('does not overwrite existing canonical default workflow', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-default-bootstrap-existing-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(
      join(paths.planetzWorkflowsDir, 'default.yaml'),
      `name: default
personas:
  custom: ../facets/personas/custom.md
steps:
  - name: run
    persona: custom
`,
      'utf8',
    )
    await mkdir(join(workspace, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
    await writeFile(
      join(workspace, DEFAULT_CONFIG.facetsDir, 'personas', 'custom.md'),
      '# Custom\n',
      'utf8',
    )

    const result = await ensureProductBuiltinWorkflows(
      workspace,
      DEFAULT_CONFIG,
      paths,
      createManagerStub(workspace),
    )

    const yaml = await readFile(join(paths.planetzWorkflowsDir, 'default.yaml'), 'utf8')
    expect(yaml).toContain('persona: custom')
    expect(result.workflowsCreated).toBe(2)
    expect(result.builtinFacetsCreated).toBeGreaterThan(0)
    expect(result.facetsMaterialized).toBeGreaterThan(0)
    await expect(
      readFile(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'custom.md'), 'utf8'),
    ).resolves.toContain('# Custom')
  })
})
