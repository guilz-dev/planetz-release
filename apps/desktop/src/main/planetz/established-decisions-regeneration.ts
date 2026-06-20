import type { EnqueueTaskInput } from '@planetz/shared'
import type { TaskCommandPort } from '../session/task-command-port.js'
import { workflowReferencesEstablishedDecisions } from './workflow-established-decisions.js'

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'unknown error'
}

export type EstablishedDecisionsRegenerationPort = Pick<
  TaskCommandPort,
  'readWorkflowYaml' | 'regenerateEstablishedDecisionsForTask'
>

/** Regenerate established-decisions facet when the task workflow references it. */
export async function regenerateEstablishedDecisionsIfNeeded(
  port: EstablishedDecisionsRegenerationPort,
  input: Pick<EnqueueTaskInput, 'title' | 'body' | 'workflow'>,
): Promise<void> {
  const workflow = input.workflow?.trim()
  if (!workflow) return
  let yaml: string | null
  try {
    yaml = await port.readWorkflowYaml(workflow)
  } catch (error) {
    console.warn('[planetz] established-decisions workflow yaml read failed', summarizeError(error))
    return
  }
  if (!yaml || !workflowReferencesEstablishedDecisions(yaml)) return
  try {
    await port.regenerateEstablishedDecisionsForTask(input)
  } catch (error) {
    console.warn('[planetz] established-decisions regeneration failed', summarizeError(error))
  }
}
