import { access } from 'node:fs/promises'
import { ROUTING_GROUPS, type WorkflowSummary } from '@planetz/shared'
import type { WorkflowRoutingCatalogStore } from './workflow-routing-catalog.js'
import { buildRoutingCatalogEntry } from './workflow-routing-catalog-entry.js'

export async function ensureWorkflowRoutingCatalogSeeded(
  store: WorkflowRoutingCatalogStore,
  workflows: WorkflowSummary[],
): Promise<boolean> {
  const path = store.routingFilePath()
  try {
    await access(path)
    return false
  } catch {
    // create-if-missing only
  }

  await store.write({
    version: 1,
    groups: [...ROUTING_GROUPS],
    workflows: workflows.map((workflow) =>
      buildRoutingCatalogEntry({
        name: workflow.name,
        categories: workflow.categories,
        source: workflow.source,
      }),
    ),
  })
  return true
}
