import { redactSecrets } from './redact-secrets.js'
import type { WorkflowRoutingAuditRecord } from './workflow-structure-routing-schema.js'

function redactStringArray(values: string[]): string[] {
  return values.map((value) => redactSecrets(value))
}

/** Redact secrets from a routing audit record before sidecar persistence. */
export function redactRoutingAuditRecord(
  record: WorkflowRoutingAuditRecord,
): WorkflowRoutingAuditRecord {
  return {
    ...record,
    taskRequirements: {
      ...record.taskRequirements,
      blockingUnknowns: redactStringArray(record.taskRequirements.blockingUnknowns),
    },
    candidatePool: record.candidatePool.map((candidate) => ({
      ...candidate,
      rejectReasons: redactStringArray(candidate.rejectReasons),
      matchedFeatures: redactStringArray(candidate.matchedFeatures),
    })),
    decisionReason: redactSecrets(record.decisionReason),
    comparedDifferences: redactStringArray(record.comparedDifferences),
  }
}
