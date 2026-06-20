import {
  OUTPUT_CONTRACT_REPORT_GROUP,
  type OutputContractRow,
  parseOutputContracts,
} from '../../../../shared/workflow-form/workflow-output-contracts.js'
import type { FacetKind, StepDraft, WorkflowDraft } from './workflow-draft-types.js'

export type { OutputContractRow }
export { parseOutputContracts }

export function getStepFacetRef(step: StepDraft, kind: FacetKind): string | undefined {
  if (kind === 'personas') return step.persona
  if (kind === 'instructions') return step.instruction
  const raw = step.raw as Record<string, unknown>
  if (kind === 'policies') return typeof raw.policy === 'string' ? raw.policy : undefined
  if (kind === 'knowledge') return typeof raw.knowledge === 'string' ? raw.knowledge : undefined
  return undefined
}

export function getStepOutputFormats(step: StepDraft): string[] {
  const out: string[] = []
  const oc = (step.raw as Record<string, unknown>).output_contracts
  if (!oc || typeof oc !== 'object') return out
  for (const list of Object.values(oc as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (entry && typeof entry === 'object') {
        const fmt = (entry as { format?: unknown }).format
        if (typeof fmt === 'string') out.push(fmt)
      }
    }
  }
  return out
}

export interface FacetKeyOption {
  key: string
  path?: string
  inWorkflowMap: boolean
}

export interface StepFacetRefReadOnly {
  readOnly: boolean
  reason?: string
}

function policyKnowledgeRawKey(kind: FacetKind): 'policy' | 'knowledge' | null {
  if (kind === 'policies') return 'policy'
  if (kind === 'knowledge') return 'knowledge'
  return null
}

export function setStepFacetRef(
  step: StepDraft,
  kind: FacetKind,
  key: string | undefined,
): StepDraft {
  if (kind === 'personas') {
    return { ...step, persona: key || undefined }
  }
  if (kind === 'instructions') {
    return { ...step, instruction: key || undefined }
  }
  const rawKey = policyKnowledgeRawKey(kind)
  if (!rawKey) return step
  const raw = { ...(step.raw as Record<string, unknown>) }
  if (key) {
    raw[rawKey] = key
  } else {
    delete raw[rawKey]
  }
  return { ...step, raw }
}

export function getStepFacetRefReadOnly(step: StepDraft, kind: FacetKind): StepFacetRefReadOnly {
  const rawKey = policyKnowledgeRawKey(kind)
  if (!rawKey) return { readOnly: false }
  const val = (step.raw as Record<string, unknown>)[rawKey]
  if (Array.isArray(val)) {
    return { readOnly: true, reason: 'Array references must be edited in YAML.' }
  }
  return { readOnly: false }
}

/** True when `step.raw.instruction` is not a plain string (e.g. `$param` objects). */
export function getStepInstructionReadOnly(step: StepDraft): StepFacetRefReadOnly {
  const ins = (step.raw as Record<string, unknown>).instruction
  if (ins === undefined) return { readOnly: false }
  if (typeof ins === 'string') return { readOnly: false }
  return {
    readOnly: true,
    reason: 'Non-string instructions ($param, etc.) must be edited in YAML.',
  }
}

export function listStepNamesForFacetRef(
  draft: WorkflowDraft,
  kind: FacetKind,
  key: string,
): string[] {
  if (!key) return []
  const names: string[] = []
  for (const s of draft.steps) {
    if (kind === 'reportFormats') {
      if (getStepOutputFormats(s).includes(key)) names.push(s.name)
    } else if (getStepFacetRef(s, kind) === key) {
      names.push(s.name)
    }
  }
  return names
}

export function collectStepRefKeys(draft: WorkflowDraft, kind: FacetKind): Set<string> {
  const stepRefs = new Set<string>()
  for (const s of draft.steps) {
    if (kind === 'reportFormats') {
      for (const f of getStepOutputFormats(s)) stepRefs.add(f)
    } else {
      const r = getStepFacetRef(s, kind)
      if (r) stepRefs.add(r)
    }
  }
  return stepRefs
}

export function collectFacetKeyOptions(
  draft: WorkflowDraft,
  kind: FacetKind,
  builtinKeys: string[],
): FacetKeyOption[] {
  const mapKeys = new Set(draft[kind].map((m) => m.key).filter(Boolean))
  const stepRefs = collectStepRefKeys(draft, kind)
  const seen = new Set<string>()
  const out: FacetKeyOption[] = []

  const push = (key: string, inWorkflowMap: boolean, path?: string) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ key, path, inWorkflowMap })
  }

  for (const m of draft[kind]) {
    if (m.key) push(m.key, true, m.path)
  }
  for (const ref of stepRefs) {
    const path = draft[kind].find((m) => m.key === ref)?.path
    push(ref, mapKeys.has(ref), path)
  }
  for (const key of builtinKeys) {
    push(key, mapKeys.has(key))
  }
  return out
}

export function isInstructionFacetKey(
  instruction: string | undefined,
  instructionKeys: string[],
): boolean {
  if (!instruction) return false
  if (instruction.includes('\n')) return false
  return instructionKeys.includes(instruction)
}

export function serializeOutputContracts(
  rows: OutputContractRow[],
): Record<string, Array<{ format: string; name?: string }>> | undefined {
  const out: Record<string, Array<{ format: string; name?: string }>> = {}
  for (const row of rows) {
    if (!row.format.trim()) continue
    const group = row.group.trim() || OUTPUT_CONTRACT_REPORT_GROUP
    if (!out[group]) out[group] = []
    const entry: { format: string; name?: string } = { format: row.format }
    if (row.name?.trim()) entry.name = row.name.trim()
    out[group].push(entry)
  }
  return Object.keys(out).length > 0 ? out : undefined
}
