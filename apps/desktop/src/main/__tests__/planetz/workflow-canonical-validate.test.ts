import { access, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME, SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { specDrivenFacetFilesForWriteProject } from '../../../shared/spec-driven/spec-driven-facet-files.js'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../../shared/spec-driven/spec-driven-workflow-yaml.js'
import { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../takt/builtin-workflow-yaml.js'
import {
  assertNoBlockingDoctorMessages,
  bundledOrbitDoctorAvailable,
} from '../bundled-orbit-test-utils.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

function defaultTemplateYamlForName(name: string): string {
  return BUILTIN_DEFAULT_WORKFLOW_YAML.replace(/^name: default/m, `name: ${name}`)
}

async function setupCanonicalManagerFixture(): Promise<{
  workspace: string
  isolatedRepo: string
  mgr: PlanetzWorkflowCanonicalManager
}> {
  const workspace = await mkdtemp(join(tmpdir(), 'planetz-wf-validate-main-'))
  const isolatedRepo = await mkdtemp(join(tmpdir(), 'planetz-wf-validate-isolated-'))
  const sidecarRoot = join(workspace, SIDECAR_DIR_NAME)
  await mkdir(sidecarRoot, { recursive: true })
  await mkdir(join(isolatedRepo, DEFAULT_CONFIG.workflowsDir), { recursive: true })
  await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir), { recursive: true })

  const mgr = new PlanetzWorkflowCanonicalManager(
    workspace,
    DEFAULT_CONFIG,
    mockSidecarPaths(sidecarRoot),
    isolatedRepo,
  )
  return { workspace, isolatedRepo, mgr }
}

describe('PlanetzWorkflowCanonicalManager.validate (new workflow registration)', () => {
  let workspace = ''
  let isolatedRepo = ''
  let mgr: PlanetzWorkflowCanonicalManager | null = null

  afterEach(async () => {
    mgr = null
    if (workspace) await rm(workspace, { recursive: true, force: true })
    if (isolatedRepo) await rm(isolatedRepo, { recursive: true, force: true })
    workspace = ''
    isolatedRepo = ''
  })

  it('returns local yaml errors without calling doctor for empty inline yaml', async () => {
    ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
    const diagnostics = await mgr.validate('my-workflow', '   ')
    expect(diagnostics.some((d) => d.level === 'error' && d.code === 'yaml_parse_error')).toBe(true)
  })

  it('materializes doctor facets under isolated .takt/facets, not .planetz/orbit/facets', async () => {
    ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
    const yaml = defaultTemplateYamlForName('my-workflow')

    await mgr.validate('my-workflow', yaml)

    await expect(
      access(join(isolatedRepo, '.takt', 'facets', 'personas', 'planner.md')),
    ).resolves.toBeUndefined()
    await expect(
      access(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'planner.md')),
    ).rejects.toBeDefined()
  })

  it('does not leave nested planetz doctor temp directories under project workflows', async () => {
    ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
    const sidecarWorkflows = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(sidecarWorkflows, { recursive: true })

    await mgr.validate('my-workflow', defaultTemplateYamlForName('my-workflow'))

    const entries = await readdir(sidecarWorkflows).catch(() => [])
    expect(entries.some((name) => name.startsWith('.planetz-wf-doctor-'))).toBe(false)
    expect(entries.some((name) => name === '.planetz-wf-doctor-my-workflow.yaml')).toBe(false)
  })

  it.runIf(bundledOrbitDoctorAvailable())(
    'passes bundled orbit doctor for default-template my-workflow inline yaml',
    async () => {
      ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
      const yaml = defaultTemplateYamlForName('my-workflow')

      const diagnostics = await mgr.validate('my-workflow', yaml)

      assertNoBlockingDoctorMessages(diagnostics)
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it.runIf(bundledOrbitDoctorAvailable())(
    'passes bundled orbit doctor for spec-driven workflow yaml and project facets',
    async () => {
      ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
      await mgr.writeProject(
        SPEC_DRIVEN_WORKFLOW_NAME,
        SPEC_DRIVEN_WORKFLOW_YAML,
        specDrivenFacetFilesForWriteProject(),
      )

      const diagnostics = await mgr.validate(SPEC_DRIVEN_WORKFLOW_NAME)

      assertNoBlockingDoctorMessages(diagnostics)
    },
    15_000,
  )

  it.runIf(bundledOrbitDoctorAvailable())(
    'can save a new default-template workflow after doctor validation',
    async () => {
      ;({ workspace, isolatedRepo, mgr } = await setupCanonicalManagerFixture())
      const yaml = defaultTemplateYamlForName('my-workflow')

      const result = await mgr.writeProject('my-workflow', yaml)
      expect(result.path).toContain('my-workflow.yaml')

      const saved = await readFile(
        join(workspace, SIDECAR_DIR_NAME, 'workflows', 'my-workflow.yaml'),
        'utf8',
      )
      expect(saved).toContain('name: my-workflow')
      expect(saved).toContain('persona: qa-reviewer')
    },
  )
})
