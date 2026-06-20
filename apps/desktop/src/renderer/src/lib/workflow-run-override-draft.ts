import type { WorkflowRunOverride } from '@planetz/shared'
import { stripRuntimeWorkflowOverrideSuffix } from '@planetz/shared'

export function baseWorkflowFromDisplayName(displayWorkflow: string): string {
  return stripRuntimeWorkflowOverrideSuffix(displayWorkflow)
}

export function normalizeRunOverrideForDisplayWorkflow(input: {
  displayWorkflow: string
  runOverride?: WorkflowRunOverride
}): WorkflowRunOverride | undefined {
  const baseWorkflow = baseWorkflowFromDisplayName(input.displayWorkflow)
  const runOverride = input.runOverride
  if (!runOverride || runOverride.baseWorkflow !== baseWorkflow) return undefined

  const normalizedStepOverrides = runOverride.stepOverrides
    .map((override) => {
      const stepName = override.stepName.trim()
      const provider = override.provider?.trim() ?? ''
      const model = override.model?.trim() ?? ''
      if (!stepName) return null
      if (!provider && !model) return null
      if (!provider && model) return null
      return {
        stepName,
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      }
    })
    .filter((override): override is NonNullable<typeof override> => Boolean(override))

  if (normalizedStepOverrides.length === 0) return undefined
  return { baseWorkflow, stepOverrides: normalizedStepOverrides }
}

export function hasRunOverrideChangesForDisplayWorkflow(input: {
  displayWorkflow: string
  runOverride?: WorkflowRunOverride
}): boolean {
  return Boolean(normalizeRunOverrideForDisplayWorkflow(input))
}

function mergeStepOverrides(input: {
  displayWorkflow: string
  runOverride?: WorkflowRunOverride
  stepName: string
  nextStepPatch: { model?: string; provider?: string }
}): WorkflowRunOverride | undefined {
  const baseWorkflow = baseWorkflowFromDisplayName(input.displayWorkflow)
  const existing =
    input.runOverride?.baseWorkflow === baseWorkflow ? input.runOverride.stepOverrides : []
  const nextOverrides = [
    ...existing.filter((o) => o.stepName !== input.stepName),
    { stepName: input.stepName, ...input.nextStepPatch },
  ].filter((o) => o.model || o.provider)

  if (nextOverrides.length === 0) return undefined
  return { baseWorkflow, stepOverrides: nextOverrides }
}

export function changeWorkflowStepExecutionProfile(input: {
  displayWorkflow: string
  runOverride?: WorkflowRunOverride
  stepName: string
  stepDefaultProvider?: string
  stepDefaultModel?: string
  providerValue: string
  modelValue: string
}): WorkflowRunOverride | undefined {
  const nextProvider = input.providerValue.trim()
  const nextModel = nextProvider ? input.modelValue.trim() : ''
  const defaultProvider = input.stepDefaultProvider?.trim() ?? ''
  const defaultModel = input.stepDefaultModel?.trim() ?? ''
  const providerMatchesDefault = nextProvider === defaultProvider
  const modelMatchesDefault = nextModel === defaultModel

  if (providerMatchesDefault && modelMatchesDefault) {
    return mergeStepOverrides({
      displayWorkflow: input.displayWorkflow,
      runOverride: input.runOverride,
      stepName: input.stepName,
      nextStepPatch: {},
    })
  }

  return mergeStepOverrides({
    displayWorkflow: input.displayWorkflow,
    runOverride: input.runOverride,
    stepName: input.stepName,
    nextStepPatch: {
      ...(nextProvider ? { provider: nextProvider } : {}),
      ...(nextProvider && nextModel ? { model: nextModel } : {}),
    },
  })
}
