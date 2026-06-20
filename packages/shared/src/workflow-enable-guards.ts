import { getBuiltinWorkflowTierMeta } from './builtin-workflow-tier.js'

export type WorkflowEnableGuardResult = {
  allowed: boolean
  reason?: 'deprecated' | 'system'
}

export function canEnableWorkflowInWorkspace(name: string): WorkflowEnableGuardResult {
  const meta = getBuiltinWorkflowTierMeta(name.trim())
  if (meta.lifecycle === 'deprecated') {
    return { allowed: false, reason: 'deprecated' }
  }
  if (meta.tier === 'system') {
    return { allowed: false, reason: 'system' }
  }
  return { allowed: true }
}

export function canEnableWorkflowForAuto(name: string): WorkflowEnableGuardResult {
  const workspace = canEnableWorkflowInWorkspace(name)
  if (!workspace.allowed) return workspace
  return { allowed: true }
}

export function isDeprecatedBuiltinWorkflow(name: string): boolean {
  return getBuiltinWorkflowTierMeta(name.trim()).lifecycle === 'deprecated'
}

/** Whether pack-level enable would surface at least one non-deprecated library member. */
export function canEnablePackInWorkspace(
  packMemberNames: readonly string[],
): WorkflowEnableGuardResult {
  if (packMemberNames.length === 0) {
    return { allowed: true }
  }
  const enableable = packMemberNames.some((name) => canEnableWorkflowInWorkspace(name).allowed)
  if (!enableable) {
    return { allowed: false, reason: 'deprecated' }
  }
  return { allowed: true }
}

export function partitionPackBrowseItems<T extends { name: string }>(
  items: readonly T[],
): { active: T[]; deprecated: T[] } {
  const active: T[] = []
  const deprecated: T[] = []
  for (const item of items) {
    if (isDeprecatedBuiltinWorkflow(item.name)) {
      deprecated.push(item)
    } else {
      active.push(item)
    }
  }
  return { active, deprecated }
}
