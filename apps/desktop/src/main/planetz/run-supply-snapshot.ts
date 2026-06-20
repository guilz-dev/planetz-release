import type { EnqueueTaskInput } from '@planetz/shared'
import type { TaskCommandPort } from '../session/task-command-port.js'
import { workflowReferencesDecidedIntentContext } from './workflow-decided-intent-context.js'
import { workflowReferencesEstablishedDecisions } from './workflow-established-decisions.js'

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'unknown error'
}

export type RunSupplySnapshotPort = Pick<
  TaskCommandPort,
  | 'readWorkflowYaml'
  | 'regenerateEstablishedDecisionsForTask'
  | 'regenerateDecidedIntentContextForTask'
  | 'upsertTaskSupplySnapshot'
>

/**
 * Regenerates established-decisions when needed and always records a supply
 * snapshot for the task run (empty when the workflow does not reference the facet).
 */
export async function captureRunSupplySnapshot(
  port: RunSupplySnapshotPort,
  taskId: string,
  input: Pick<EnqueueTaskInput, 'title' | 'body' | 'workflow'>,
): Promise<void> {
  const workflow = input.workflow?.trim()
  let entryIds: string[] = []

  if (workflow) {
    try {
      const yaml = await port.readWorkflowYaml(workflow)
      if (yaml && workflowReferencesEstablishedDecisions(yaml)) {
        entryIds = await port.regenerateEstablishedDecisionsForTask(input)
      }
      if (yaml && workflowReferencesDecidedIntentContext(yaml)) {
        await port.regenerateDecidedIntentContextForTask(taskId)
      }
    } catch (error) {
      console.warn('[planetz] run supply snapshot workflow read failed', summarizeError(error))
    }
  }

  try {
    await port.upsertTaskSupplySnapshot(taskId, entryIds)
  } catch (error) {
    console.warn('[planetz] run supply snapshot persist failed', summarizeError(error))
  }
}
