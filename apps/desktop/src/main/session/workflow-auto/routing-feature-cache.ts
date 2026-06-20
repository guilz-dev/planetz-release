import { buildWorkflowFeatureIndex, type WorkflowFeatureIndex } from './workflow-feature-index.js'
import type { WorkflowYamlResolver } from './workflow-yaml-resolver.js'

export function buildWorkflowRoutingResolverKey(input: {
  mockQueue: boolean
  planetzWorkflowsDir: string
  workspacePath: string
  taktRepoPath: string | null
}): string {
  return [
    input.mockQueue ? 'mock' : 'prod',
    input.planetzWorkflowsDir,
    input.workspacePath,
    input.taktRepoPath ?? '',
  ].join('|')
}

export class WorkflowRoutingFeatureCache {
  private index: WorkflowFeatureIndex = new Map()
  private resolverKey: string | null = null

  invalidate(): void {
    this.index.clear()
    this.resolverKey = null
  }

  ensureResolverKey(key: string): void {
    if (this.resolverKey === key) return
    this.index.clear()
    this.resolverKey = key
  }

  async resolveMissing(
    workflowNames: string[],
    resolver: WorkflowYamlResolver,
  ): Promise<WorkflowFeatureIndex> {
    const missing = workflowNames.filter((name) => !this.index.has(name))
    if (missing.length > 0) {
      const built = await buildWorkflowFeatureIndex(missing, resolver)
      for (const [name, features] of built) {
        this.index.set(name, features)
      }
    }
    return this.index
  }
}
