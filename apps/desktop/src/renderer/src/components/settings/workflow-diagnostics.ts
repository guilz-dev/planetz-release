import type { WorkflowDiagnostic } from '@planetz/shared'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { RESERVED_STEP_NAMES } from './workflow-shared-constants.js'

export function isReservedStepName(name: string): boolean {
  return RESERVED_STEP_NAMES.has(name.trim().toUpperCase())
}

export interface RoutedDiagnostics {
  byStep: Map<string, WorkflowDiagnostic[]>
  global: WorkflowDiagnostic[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Best-effort routing of doctor messages onto step cards (§5.4.1). */
export function routeDiagnosticsToSteps(
  draft: WorkflowDraft,
  diagnostics: WorkflowDiagnostic[],
): RoutedDiagnostics {
  const byStep = new Map<string, WorkflowDiagnostic[]>()
  const global: WorkflowDiagnostic[] = []
  const stepNames = draft.steps.map((s) => s.name).filter(Boolean)

  for (const d of diagnostics) {
    if (d.level !== 'error' && d.level !== 'warn') continue
    const haystack = `${d.message} ${d.path ?? ''}`
    let matchedName: string | undefined

    const stepIndex = haystack.match(/steps?\s*\[(\d+)\]/i)
    if (stepIndex) {
      const idx = Number(stepIndex[1])
      matchedName = draft.steps[idx]?.name
    }

    if (!matchedName) {
      const ordered = [...stepNames].sort((a, b) => b.length - a.length)
      for (const name of ordered) {
        const pattern = new RegExp(
          `\\b${escapeRegExp(name)}\\b|step\\s+['"]${escapeRegExp(name)}['"]`,
          'i',
        )
        if (pattern.test(haystack)) {
          matchedName = name
          break
        }
      }
    }

    if (matchedName) {
      const list = byStep.get(matchedName) ?? []
      list.push(d)
      byStep.set(matchedName, list)
    } else {
      global.push(d)
    }
  }

  return { byStep, global }
}

export function renameStepInDraft(
  draft: WorkflowDraft,
  oldName: string,
  newName: string,
): WorkflowDraft {
  const next: WorkflowDraft = {
    ...draft,
    initialStep: draft.initialStep === oldName ? newName : draft.initialStep,
    steps: draft.steps.map((s) => ({
      ...s,
      name: s.name === oldName ? newName : s.name,
      rules: s.rules.map((r) => ({ ...r, next: r.next === oldName ? newName : r.next })),
    })),
  }
  return next
}

export function findRuleReferences(draft: WorkflowDraft, stepName: string): number {
  let count = 0
  for (const s of draft.steps) for (const r of s.rules) if (r.next === stepName) count += 1
  if (draft.initialStep === stepName) count += 1
  return count
}

export function findDanglingRefs(draft: WorkflowDraft): Array<{ from: string; next: string }> {
  const names = new Set(draft.steps.map((s) => s.name))
  const dangling: Array<{ from: string; next: string }> = []
  for (const s of draft.steps) {
    for (const r of s.rules) {
      if (!r.next) continue
      if (!names.has(r.next) && !isReservedStepName(r.next)) {
        dangling.push({ from: s.name, next: r.next })
      }
    }
  }
  return dangling
}
