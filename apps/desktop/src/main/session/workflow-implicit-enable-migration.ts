import {
  mergeImplicitLibraryWorkflows,
  type PromptHistoryItem,
  type TaskViewModel,
  type UiConfig,
  type WorkflowSummary,
} from '@planetz/shared'
import { buildWorkflowSourceMap } from './workflow-auto/workflow-source-map.js'

export function collectImplicitWorkflowUsageCandidates(input: {
  promptHistory: PromptHistoryItem[]
  tasks: TaskViewModel[]
}): string[] {
  const names: string[] = []
  for (const item of input.promptHistory) {
    if (item.workflow?.trim()) names.push(item.workflow.trim())
    const autoWorkflow = item.autoDecision?.selectedWorkflow?.trim()
    if (autoWorkflow) names.push(autoWorkflow)
  }
  for (const task of input.tasks) {
    if (task.workflow?.trim()) names.push(task.workflow.trim())
  }
  return names
}

export function applyImplicitLibraryWorkflowMigration(
  config: UiConfig,
  workflows: WorkflowSummary[],
  candidates: string[],
): { config: UiConfig; changed: boolean } {
  const workflowsByName = buildWorkflowSourceMap(workflows)
  const merged = mergeImplicitLibraryWorkflows(
    config.ui.workflowLibrary,
    candidates,
    workflowsByName,
  )
  if (!merged.changed) {
    return { config, changed: false }
  }
  return {
    config: {
      ...config,
      ui: {
        ...config.ui,
        workflowLibrary: merged.prefs,
      },
    },
    changed: true,
  }
}
