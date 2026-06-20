import YAML from 'yaml'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { parseWorkflowYaml } from './workflow-parse.js'
import { serializeWorkflowDraft } from './workflow-serialize.js'

export function isFormSafe(draft: WorkflowDraft): boolean {
  if (draft.parseError) return false
  if (draft.unsupportedKeys.length > 0) return false
  if (draft.steps.some((s) => s.special)) return false
  return true
}

/** Structural fingerprint of raw YAML (top-level + per-step keys). */
export function structuralFingerprint(yaml: string): string {
  try {
    const root = (YAML.parse(yaml) ?? {}) as Record<string, unknown>
    const parts: string[] = Object.keys(root)
      .sort()
      .map((k) => `@${k}`)
    const steps = Array.isArray(root.steps) ? (root.steps as Array<Record<string, unknown>>) : []
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step || typeof step !== 'object') continue
      for (const k of Object.keys(step).sort()) {
        parts.push(`steps[${i}].${k}`)
      }
    }
    return parts.join('|')
  } catch {
    return ''
  }
}

function hasStructuralLoss(draft: WorkflowDraft, yaml: string): boolean {
  if (draft.parseError) return true
  if (draft.unsupportedKeys.length > 0) return true
  const before = structuralFingerprint(yaml)
  const roundTripped = serializeWorkflowDraft(draft)
  const after = structuralFingerprint(roundTripped)
  if (before !== after) return true
  const reparsed = parseWorkflowYaml(roundTripped)
  if (reparsed.parseError) return true
  if (reparsed.unsupportedKeys.length > 0) return true
  return false
}

/** True when parse → serialize would drop unsupported structure from the source YAML. */
export function hasRoundTripLoss(yaml: string): boolean {
  const draft = parseWorkflowYaml(yaml)
  if (!yaml.trim()) return false
  return hasStructuralLoss(draft, yaml)
}
