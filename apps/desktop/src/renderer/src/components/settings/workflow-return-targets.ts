import { subworkflowReturnNames } from '../../../../shared/workflow-form/workflow-rule-condition.js'
import type { WorkflowDraft } from './workflow-draft-types.js'

export function workflowReturnTargets(draft: WorkflowDraft): string[] {
  return subworkflowReturnNames(draft.subworkflow)
}
