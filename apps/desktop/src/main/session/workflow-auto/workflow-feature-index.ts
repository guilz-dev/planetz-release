import type { WorkflowStructureFeatures } from '@planetz/shared'
import { extractWorkflowStructureFeatures } from './workflow-feature-extractor.js'
import type { WorkflowYamlResolver } from './workflow-yaml-resolver.js'

export type WorkflowFeatureIndex = Map<string, WorkflowStructureFeatures>

export async function buildWorkflowFeatureIndex(
  workflowNames: string[],
  resolver: WorkflowYamlResolver,
): Promise<WorkflowFeatureIndex> {
  const index: WorkflowFeatureIndex = new Map()
  await Promise.all(
    workflowNames.map(async (name) => {
      const features = await extractWorkflowStructureFeatures(name, resolver)
      if (features) index.set(name, features)
    }),
  )
  return index
}
