import { redactSecrets } from './redact-secrets.js'
import type { AutoWorkflowDecision } from './types.js'

/** Redact secrets from an auto-routing decision before sidecar persistence. */
export function redactAutoDecisionForStorage(decision: AutoWorkflowDecision): AutoWorkflowDecision {
  return {
    ...decision,
    reasonCodes: decision.reasonCodes.map((code) => redactSecrets(code)),
    alternatives: decision.alternatives.map((alt) => ({
      ...alt,
      name: redactSecrets(alt.name),
      group: redactSecrets(alt.group),
    })),
  }
}
