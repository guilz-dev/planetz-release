import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHAT_INVESTIGATION_WORKFLOW_NAME,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  orbitFacetsPath,
  PRODUCT_DEFAULT_WORKFLOW_NAME,
  type UiConfig,
  type WorkflowDiagnostic,
} from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { ensureCanonicalDirWorkflowFacetsMaterialized } from '../takt/facet-resolver.js'
import { ensureBuiltinFacetFiles } from './planetz-builtin-facet-seed.js'
import { ensureBuiltinWorkflowFiles } from './planetz-builtin-workflow-seed.js'
import type { PlanetzWorkflowCanonicalManager } from './workflow-canonical-manager.js'

const PRODUCT_WORKFLOW_NAMES = [
  PRODUCT_DEFAULT_WORKFLOW_NAME,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  CHAT_INVESTIGATION_WORKFLOW_NAME,
] as const

export interface ProductBuiltinWorkflowBootstrapResult {
  workflowsCreated: number
  builtinFacetsCreated: number
  facetRefs: number
  facetsMaterialized: number
  warnings: WorkflowDiagnostic[]
}

export async function ensureProductBuiltinWorkflows(
  mainWorkspacePath: string,
  config: UiConfig,
  sidecarPaths: SidecarPaths,
  manager: PlanetzWorkflowCanonicalManager,
): Promise<ProductBuiltinWorkflowBootstrapResult> {
  const workflowsDir = sidecarPaths.planetzWorkflowsDir
  const { workflowsCreated } = await ensureBuiltinWorkflowFiles(sidecarPaths, 'product', {
    onWorkflowFileCreated: () => manager.invalidateListCache(),
  })

  const facetsRoot = orbitFacetsPath(mainWorkspacePath)
  const fallbackFacetsRoot = join(mainWorkspacePath, config.facetsDir)
  await mkdir(facetsRoot, { recursive: true })
  const builtinFacetsCreated = await ensureBuiltinFacetFiles(facetsRoot)

  const warnings: WorkflowDiagnostic[] = []
  for (const name of PRODUCT_WORKFLOW_NAMES) {
    const yaml = await readFile(join(workflowsDir, `${name}.yaml`), 'utf8')
    const diagnostics = await manager.validate(name, yaml).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      return [
        {
          level: 'warn',
          message: `${name} workflow validation failed during bootstrap: ${message}`,
        } satisfies WorkflowDiagnostic,
      ]
    })
    warnings.push(...diagnostics.filter((d) => d.level !== 'info'))
  }

  const materialize = await ensureCanonicalDirWorkflowFacetsMaterialized(facetsRoot, workflowsDir, {
    fallbackFacetsRoot,
  })

  return {
    workflowsCreated,
    builtinFacetsCreated,
    facetRefs: materialize.facetRefs,
    facetsMaterialized: materialize.facetsMaterialized,
    warnings,
  }
}

/** @deprecated Use {@link ensureProductBuiltinWorkflows}. */
export async function ensureProductDefaultWorkflow(
  mainWorkspacePath: string,
  config: UiConfig,
  sidecarPaths: SidecarPaths,
  manager: PlanetzWorkflowCanonicalManager,
): Promise<ProductBuiltinWorkflowBootstrapResult> {
  return ensureProductBuiltinWorkflows(mainWorkspacePath, config, sidecarPaths, manager)
}
