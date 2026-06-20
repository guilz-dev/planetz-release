import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME, SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { SPEC_DRIVEN_INSTALLER_SENTINEL } from '../../../shared/spec-driven/spec-driven-installer-version.js'
import {
  installSpecDrivenWorkflow,
  upgradeInstalledSpecDrivenWorkflowIfStale,
} from '../../planetz/spec-driven-installer.js'
import { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

describe('installSpecDrivenWorkflow', () => {
  let workspace = ''
  let isolatedRepo = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    if (isolatedRepo) await rm(isolatedRepo, { recursive: true, force: true })
    workspace = ''
    isolatedRepo = ''
  })

  it(
    'writes workflow and project facets into canonical sidecar',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'spec-driven-install-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'spec-driven-install-isolated-'))
      const sidecarRoot = join(workspace, SIDECAR_DIR_NAME)
      const paths = mockSidecarPaths(sidecarRoot)
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })

      const mgr = new PlanetzWorkflowCanonicalManager(
        workspace,
        DEFAULT_CONFIG,
        paths,
        isolatedRepo,
      )

      const result = await installSpecDrivenWorkflow(mgr, paths.planetzWorkflowsDir)
      expect(result.created).toBe(true)
      expect(result.facetsWritten).toBeGreaterThan(0)

      const yaml = await readFile(
        join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`),
        'utf8',
      )
      expect(yaml.startsWith(SPEC_DRIVEN_INSTALLER_SENTINEL)).toBe(true)
      expect(yaml).toContain(`name: ${SPEC_DRIVEN_WORKFLOW_NAME}`)
      expect(yaml).toContain('output_contracts:')
      expect(yaml).toContain('report:')
      expect(yaml).toContain('decisions.json')

      await expect(
        access(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'business-analyst.md')),
      ).resolves.toBeUndefined()

      const again = await installSpecDrivenWorkflow(mgr, paths.planetzWorkflowsDir)
      expect(again.created).toBe(false)
      expect(again.upgraded).toBe(false)
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it(
    'upgrades outdated installer-managed workflow when sentinel version mismatches',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'spec-driven-upgrade-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'spec-driven-upgrade-isolated-'))
      const sidecarRoot = join(workspace, SIDECAR_DIR_NAME)
      const paths = mockSidecarPaths(sidecarRoot)
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })

      const legacyPath = join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
      await writeFile(
        legacyPath,
        `# managed-by: spec-driven-installer v1\nname: ${SPEC_DRIVEN_WORKFLOW_NAME}\ninitial_step: design\n`,
        'utf8',
      )

      const mgr = new PlanetzWorkflowCanonicalManager(
        workspace,
        DEFAULT_CONFIG,
        paths,
        isolatedRepo,
      )

      const result = await installSpecDrivenWorkflow(mgr, paths.planetzWorkflowsDir)
      expect(result.created).toBe(false)
      expect(result.upgraded).toBe(true)
      expect(result.facetsWritten).toBeGreaterThan(0)

      const yaml = await readFile(legacyPath, 'utf8')
      expect(yaml.startsWith(SPEC_DRIVEN_INSTALLER_SENTINEL)).toBe(true)
      expect(yaml).toContain('decisions.json')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('upgradeInstalledSpecDrivenWorkflowIfStale is a no-op when spec-driven is not installed', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'spec-driven-stale-skip-'))
    isolatedRepo = await mkdtemp(join(tmpdir(), 'spec-driven-stale-skip-isolated-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
    const mgr = new PlanetzWorkflowCanonicalManager(workspace, DEFAULT_CONFIG, paths, isolatedRepo)

    await expect(
      upgradeInstalledSpecDrivenWorkflowIfStale(mgr, paths.planetzWorkflowsDir),
    ).resolves.toBeNull()
  })

  it(
    'upgradeInstalledSpecDrivenWorkflowIfStale upgrades only when sentinel is stale',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'spec-driven-stale-upgrade-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'spec-driven-stale-upgrade-isolated-'))
      const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
      const legacyPath = join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
      await writeFile(
        legacyPath,
        `# managed-by: spec-driven-installer v1\nname: ${SPEC_DRIVEN_WORKFLOW_NAME}\n`,
        'utf8',
      )
      const mgr = new PlanetzWorkflowCanonicalManager(
        workspace,
        DEFAULT_CONFIG,
        paths,
        isolatedRepo,
      )

      const result = await upgradeInstalledSpecDrivenWorkflowIfStale(mgr, paths.planetzWorkflowsDir)
      expect(result?.upgraded).toBe(true)
      const yaml = await readFile(legacyPath, 'utf8')
      expect(yaml.startsWith(SPEC_DRIVEN_INSTALLER_SENTINEL)).toBe(true)
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it(
    'forces rewrite when overwrite is true even at current installer version',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'spec-driven-overwrite-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'spec-driven-overwrite-isolated-'))
      const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
      const mgr = new PlanetzWorkflowCanonicalManager(
        workspace,
        DEFAULT_CONFIG,
        paths,
        isolatedRepo,
      )

      const initial = await installSpecDrivenWorkflow(mgr, paths.planetzWorkflowsDir)
      expect(initial.created).toBe(true)

      const workflowPath = join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
      await writeFile(
        workflowPath,
        `${SPEC_DRIVEN_INSTALLER_SENTINEL}\nname: ${SPEC_DRIVEN_WORKFLOW_NAME}\ncustom: true\n`,
        'utf8',
      )

      const forced = await installSpecDrivenWorkflow(mgr, paths.planetzWorkflowsDir, {
        overwrite: true,
      })
      expect(forced.upgraded).toBe(false)
      expect(forced.facetsWritten).toBeGreaterThan(0)

      const yaml = await readFile(workflowPath, 'utf8')
      expect(yaml).toContain('decisions.json')
      expect(yaml).not.toContain('custom: true')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )
})
