import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type AutoWorkflowDecision,
  type EnqueueTaskBridgeInput,
  ORBIT_RUNTIME_WORKFLOWS_DIRNAME,
  stripRuntimeWorkflowOverrideSuffix,
  type TaskWorkflowSelectionMeta,
  type WorkflowRunOverride,
} from '@planetz/shared'
import { syncWorkflowYamlToTaktGlobal } from '../../planetz/takt-runtime-adapter.js'
import type { SidecarPaths } from '../../sidecar/sidecar-paths.js'
import {
  applyWorkflowRunOverride,
  resolvedWorkflowNameForOverride,
} from './workflow-run-override-resolver.js'

function runOverrideHasStepChanges(override: WorkflowRunOverride): boolean {
  return override.stepOverrides.some((o) => Boolean(o.provider?.trim()) || Boolean(o.model?.trim()))
}

/** True when `resolvedWorkflow` is a runtime materialization of `override.baseWorkflow`. */
export function isRunOverrideAppliedToResolvedWorkflow(
  override: WorkflowRunOverride,
  resolvedWorkflow: string,
): boolean {
  const resolvedBase = stripRuntimeWorkflowOverrideSuffix(resolvedWorkflow)
  return resolvedBase === override.baseWorkflow && resolvedWorkflow !== resolvedBase
}

export function buildWorkflowSelectionMeta(
  original: EnqueueTaskBridgeInput,
  resolvedWorkflow: string | undefined,
  autoDecision?: AutoWorkflowDecision,
  resolvedSelectionKind?: EnqueueTaskBridgeInput['workflowSelectionKind'],
): TaskWorkflowSelectionMeta | undefined {
  const workflow = resolvedWorkflow?.trim()
  if (!workflow) return undefined

  if (original.runOverride && runOverrideHasStepChanges(original.runOverride)) {
    if (isRunOverrideAppliedToResolvedWorkflow(original.runOverride, workflow)) {
      return {
        kind: 'modified',
        baseWorkflow: original.runOverride.baseWorkflow,
        resolvedWorkflow: workflow,
        runOverride: original.runOverride,
      }
    }
  }

  const confirmedWorkflow = original.confirmedWorkflow?.trim()
  const selectionKind = resolvedSelectionKind ?? original.workflowSelectionKind
  if (autoDecision || selectionKind === 'auto' || confirmedWorkflow) {
    return {
      kind: 'auto',
      baseWorkflow: autoDecision?.selectedWorkflow ?? confirmedWorkflow ?? workflow,
      resolvedWorkflow: workflow,
    }
  }

  if (selectionKind === 'manual') {
    return {
      kind: 'manual',
      baseWorkflow: workflow,
      resolvedWorkflow: workflow,
    }
  }

  if ((original.workflowMode ?? 'manual') === 'manual') {
    return {
      kind: 'manual',
      baseWorkflow: workflow,
      resolvedWorkflow: workflow,
    }
  }

  return undefined
}

export async function materializeRunOverrideWorkflow(
  paths: SidecarPaths,
  baseYaml: string,
  override: NonNullable<EnqueueTaskBridgeInput['runOverride']>,
): Promise<string> {
  const modifiedYaml = applyWorkflowRunOverride(baseYaml, override)
  const runtimeName = resolvedWorkflowNameForOverride(override.baseWorkflow, override)
  const runtimeDir = join(paths.root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME)
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(join(runtimeDir, `${runtimeName}.yaml`), modifiedYaml, 'utf8')
  await syncWorkflowYamlToTaktGlobal(paths, runtimeName, modifiedYaml)
  return runtimeName
}
