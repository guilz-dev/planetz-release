import { SPEC_DRIVEN_WORKFLOW_NAME, type WorkflowRoutingEntry } from '@planetz/shared'

type WorkflowRoutingMetadata = Pick<
  WorkflowRoutingEntry,
  'routingGroups' | 'complexityBand' | 'safetyTier'
>

const WORKFLOW_ROUTING_METADATA: Record<string, WorkflowRoutingMetadata> = {
  [SPEC_DRIVEN_WORKFLOW_NAME]: {
    routingGroups: ['feature'],
    complexityBand: 'high',
    safetyTier: 'safe',
  },
}

export function routingMetadataForWorkflow(name: string): WorkflowRoutingMetadata | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  return WORKFLOW_ROUTING_METADATA[trimmed]
}

export function applyRoutingMetadataToEntry<T extends WorkflowRoutingEntry>(entry: T): T {
  const meta = routingMetadataForWorkflow(entry.name)
  if (!meta) return entry
  return {
    ...entry,
    routingGroups: meta.routingGroups ?? entry.routingGroups,
    complexityBand: meta.complexityBand ?? entry.complexityBand,
    safetyTier: meta.safetyTier ?? entry.safetyTier,
  }
}
