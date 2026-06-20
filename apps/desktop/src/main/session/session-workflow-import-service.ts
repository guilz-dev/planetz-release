import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import type { AppSession } from '../app-session.js'
import { importWorkflowFromTakt } from '../planetz/canonical-bootstrap.js'
import { installSpecDrivenWorkflow } from '../planetz/spec-driven-installer.js'

/** Project workflow writes and takt import orchestration. */
export class SessionWorkflowImportService {
  constructor(private readonly session: AppSession) {}

  async installSpecDrivenWorkflow(): Promise<{ path: string }> {
    const manager = this.session.canonicalWorkflowManager
    if (!manager) {
      throw new Error('Canonical workflow manager is not available for this workspace.')
    }
    const paths = this.session.requireSidecarPaths()
    const install = await installSpecDrivenWorkflow(manager, paths.planetzWorkflowsDir)
    if (!install.created && !install.upgraded) {
      throw new Error(`Workflow "${SPEC_DRIVEN_WORKFLOW_NAME}" already exists in this workspace.`)
    }
    return this.finalizeWorkflowWrite({ path: install.path })
  }

  async writeProjectWorkflow(
    name: string,
    yaml: string,
    facetFiles?: Record<string, string>,
  ): Promise<{ path: string }> {
    const result = await Promise.resolve(
      this.session.workflowManager.writeProject(name, yaml, facetFiles),
    )
    return this.finalizeWorkflowWrite(result)
  }

  async importWorkflowFromTakt(
    name: string,
    options?: { overwrite?: boolean },
  ): Promise<{ path: string; overwritten: boolean }> {
    const paths = this.session.requireSidecarPaths()
    const result = await importWorkflowFromTakt(
      this.session.requireWorkspacePath(),
      this.session.requireConfig(),
      paths,
      name,
      {
        ...options,
        taktRepoPath: this.session.isolatedTaktWorkspace?.isolatedRepoPath,
      },
    )
    this.session.invalidateWorkflowRoutingCaches()
    await this.session.workspaceRuntime.restartWatchIfRunning()
    return result
  }

  private async finalizeWorkflowWrite(result: { path: string }): Promise<{ path: string }> {
    this.session.invalidateWorkflowRoutingCaches()
    this.session.configExecution.invalidateExecutionCatalogCache()
    await this.session.workspaceRuntime.restartWatchIfRunning()
    return result
  }
}
