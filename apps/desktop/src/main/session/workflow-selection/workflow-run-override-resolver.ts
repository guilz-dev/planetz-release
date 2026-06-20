import { createHash } from 'node:crypto'
import {
  runtimeWorkflowOverrideName,
  type WorkflowRoutingCatalog,
  type WorkflowRunOverride,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { parseWorkflowYaml } from '../../../shared/workflow-form/workflow-parse.js'

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function workflowHasStrictSafetyTier(
  catalogEntry: { safetyTier?: string } | undefined,
): boolean {
  return catalogEntry?.safetyTier === 'strict'
}

export function assertRunOverrideAllowedForWorkflow(
  catalog: WorkflowRoutingCatalog,
  baseWorkflow: string,
): void {
  const entry = catalog.workflows.find((workflow) => workflow.name === baseWorkflow)
  if (workflowHasStrictSafetyTier(entry)) {
    throw new Error(`Per-run overrides are not allowed for strict-tier workflow "${baseWorkflow}"`)
  }
}

export function applyWorkflowRunOverride(baseYaml: string, override: WorkflowRunOverride): string {
  const draft = parseWorkflowYaml(baseYaml)
  const overrideByStep = new Map(override.stepOverrides.map((o) => [o.stepName, o]))
  const root = asObject(parseYaml(baseYaml))
  if (!root || !Array.isArray(root.steps)) {
    return baseYaml
  }

  const nextSteps: unknown[] = []
  for (const step of draft.steps) {
    const patch = overrideByStep.get(step.name)
    if (patch?.model && !patch.provider) {
      throw new Error(`Step model override requires provider: ${step.name}`)
    }
    const rawStep = { ...step.raw }
    if (patch?.provider) {
      rawStep.provider = patch.provider
      // Provider-only override intentionally clears model to inherit provider defaults.
      if (!patch.model) delete rawStep.model
    }
    if (patch?.model) rawStep.model = patch.model
    nextSteps.push(rawStep)
  }

  root.steps = nextSteps
  return stringifyYaml(root, { lineWidth: 0 })
}

export function resolvedWorkflowNameForOverride(
  baseWorkflow: string,
  override: WorkflowRunOverride,
): string {
  const normalizedOverrides = normalizeStepOverridesForRuntimeName(override)
  if (normalizedOverrides.length === 0) return baseWorkflow
  const signature = JSON.stringify({
    baseWorkflow: baseWorkflow.trim(),
    stepOverrides: normalizedOverrides,
  })
  const variant = createHash('sha256').update(signature).digest('hex').slice(0, 8)
  return runtimeWorkflowOverrideName(baseWorkflow, variant)
}

function normalizeStepOverridesForRuntimeName(override: WorkflowRunOverride): Array<{
  stepName: string
  provider: string
  model?: string
}> {
  return override.stepOverrides
    .map((stepOverride) => {
      const stepName = stepOverride.stepName.trim()
      const provider = stepOverride.provider?.trim() ?? ''
      const model = stepOverride.model?.trim() ?? ''
      if (!stepName || !provider) return null
      return {
        stepName,
        provider,
        ...(model ? { model } : {}),
      }
    })
    .filter((stepOverride): stepOverride is NonNullable<typeof stepOverride> =>
      Boolean(stepOverride),
    )
    .sort((left, right) => {
      if (left.stepName !== right.stepName) return left.stepName.localeCompare(right.stepName)
      if (left.provider !== right.provider) return left.provider.localeCompare(right.provider)
      return (left.model ?? '').localeCompare(right.model ?? '')
    })
}
