import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME, SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { SPEC_DRIVEN_INSTALLER_SENTINEL } from '../../shared/spec-driven/spec-driven-installer-version.js'
import { PlanetzWorkflowCanonicalManager } from '../planetz/workflow-canonical-manager.js'
import { SessionWorkflowImportService } from '../session/session-workflow-import-service.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from './test-timeouts.js'

describe('SessionWorkflowImportService', () => {
  let workspace = ''
  let isolatedRepo = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    if (isolatedRepo) await rm(isolatedRepo, { recursive: true, force: true })
    workspace = ''
    isolatedRepo = ''
  })

  function createService(): SessionWorkflowImportService {
    const sidecarRoot = join(workspace, SIDECAR_DIR_NAME)
    const paths = mockSidecarPaths(sidecarRoot)
    const canonicalWorkflowManager = new PlanetzWorkflowCanonicalManager(
      workspace,
      DEFAULT_CONFIG,
      paths,
      isolatedRepo,
    )
    const session = {
      canonicalWorkflowManager,
      requireSidecarPaths: () => paths,
      invalidateWorkflowRoutingCaches: () => undefined,
      configExecution: { invalidateExecutionCatalogCache: () => undefined },
      workspaceRuntime: { restartWatchIfRunning: async () => undefined },
      workflowManager: canonicalWorkflowManager,
    }
    return new SessionWorkflowImportService(session as never)
  }

  it(
    'installSpecDrivenWorkflow materializes canonical workflow and facets',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'session-wf-install-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'session-wf-install-isolated-'))
      const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })

      const service = createService()
      const result = await service.installSpecDrivenWorkflow()

      expect(result.path).toContain(`${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
      await expect(
        access(join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)),
      ).resolves.toBeUndefined()

      await expect(service.installSpecDrivenWorkflow()).rejects.toThrow(/already exists/i)
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it(
    'installSpecDrivenWorkflow upgrades stale installer-managed workflow without error',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'session-wf-upgrade-'))
      isolatedRepo = await mkdtemp(join(tmpdir(), 'session-wf-upgrade-isolated-'))
      const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
      await mkdir(paths.planetzWorkflowsDir, { recursive: true })
      await mkdir(join(isolatedRepo, DEFAULT_CONFIG.facetsDir, 'personas'), { recursive: true })
      await writeFile(
        join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`),
        `# managed-by: spec-driven-installer v1\nname: ${SPEC_DRIVEN_WORKFLOW_NAME}\n`,
        'utf8',
      )

      const service = createService()
      const result = await service.installSpecDrivenWorkflow()

      expect(result.path).toContain(`${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
      const yaml = await readFile(
        join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`),
        'utf8',
      )
      expect(yaml.startsWith(SPEC_DRIVEN_INSTALLER_SENTINEL)).toBe(true)
      expect(yaml).toContain('decisions.json')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )
})
