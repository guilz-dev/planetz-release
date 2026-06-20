import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { specDrivenFacetFilesForWriteProject } from '../../shared/spec-driven/spec-driven-facet-files.js'
import {
  SPEC_DRIVEN_INSTALLER_SENTINEL,
  specDrivenWorkflowHasCurrentInstallerVersion,
} from '../../shared/spec-driven/spec-driven-installer-version.js'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../shared/spec-driven/spec-driven-workflow-yaml.js'
import type { PlanetzWorkflowCanonicalManager } from './workflow-canonical-manager.js'

export interface InstallSpecDrivenWorkflowResult {
  path: string
  created: boolean
  upgraded: boolean
  facetsWritten: number
}

async function readExistingWorkflowYaml(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Upgrade spec-driven workflow/facets when already installed but installer sentinel is stale.
 * No-op when the workflow is missing or already at the current installer version.
 */
export async function upgradeInstalledSpecDrivenWorkflowIfStale(
  manager: PlanetzWorkflowCanonicalManager,
  sidecarWorkflowsDir: string,
): Promise<InstallSpecDrivenWorkflowResult | null> {
  const target = join(sidecarWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
  try {
    await access(target)
  } catch {
    return null
  }
  const existingYaml = await readExistingWorkflowYaml(target)
  if (!existingYaml || specDrivenWorkflowHasCurrentInstallerVersion(existingYaml)) {
    return null
  }
  return installSpecDrivenWorkflow(manager, sidecarWorkflowsDir)
}

/** Materialize spec-driven workflow + project facets into canonical sidecar when absent or outdated. */
export async function installSpecDrivenWorkflow(
  manager: PlanetzWorkflowCanonicalManager,
  sidecarWorkflowsDir: string,
  options?: { overwrite?: boolean },
): Promise<InstallSpecDrivenWorkflowResult> {
  const target = join(sidecarWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)
  let exists = false
  try {
    await access(target)
    exists = true
  } catch {
    // missing
  }

  const existingYaml = exists ? await readExistingWorkflowYaml(target) : null
  const needsUpgrade =
    exists && existingYaml !== null && !specDrivenWorkflowHasCurrentInstallerVersion(existingYaml)

  if (exists && !options?.overwrite && !needsUpgrade) {
    const read = await manager.read(SPEC_DRIVEN_WORKFLOW_NAME, 'project')
    return { path: read.path ?? target, created: false, upgraded: false, facetsWritten: 0 }
  }

  const facetFiles = specDrivenFacetFilesForWriteProject()
  const result = await manager.writeProject(
    SPEC_DRIVEN_WORKFLOW_NAME,
    SPEC_DRIVEN_WORKFLOW_YAML,
    facetFiles,
  )
  return {
    path: result.path,
    created: !exists,
    upgraded: exists && needsUpgrade,
    facetsWritten: Object.keys(facetFiles).length,
  }
}

export { SPEC_DRIVEN_INSTALLER_SENTINEL }
