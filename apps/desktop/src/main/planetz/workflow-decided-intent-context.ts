import { DECIDED_INTENT_CONTEXT_FACET_KEY } from '@planetz/shared'
import { escapeRegExp } from '../lib/escape-reg-exp.js'

/** True when workflow YAML references the decided-intent-context knowledge facet. */
export function workflowReferencesDecidedIntentContext(yaml: string): boolean {
  const key = DECIDED_INTENT_CONTEXT_FACET_KEY
  const facetMapPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`, 'm')
  if (facetMapPattern.test(yaml)) return true
  const knowledgeListPattern = new RegExp(`^\\s*-\\s*${escapeRegExp(key)}\\s*$`, 'm')
  if (knowledgeListPattern.test(yaml)) return true
  return new RegExp(`\\b${escapeRegExp(key)}\\b`).test(yaml)
}
