import { CHAT_INVESTIGATION_WORKFLOW_NAME } from './constants.js'

const CHAT_ONLY_WORKFLOW_NAMES = new Set<string>([CHAT_INVESTIGATION_WORKFLOW_NAME])

/** True when the workflow is reserved for chat-only investigation flows. */
export function isChatOnlyWorkflowName(name: string): boolean {
  return CHAT_ONLY_WORKFLOW_NAMES.has(name.trim())
}

/** True when workflow can be selected by Add Task / task execution flows. */
export function isTaskUsableWorkflowName(name: string): boolean {
  return !isChatOnlyWorkflowName(name)
}

export function filterTaskUsableWorkflowNames(names: ReadonlyArray<string>): string[] {
  return names.filter((name) => isTaskUsableWorkflowName(name))
}

export function filterTaskUsableWorkflows<T extends { name: string }>(
  workflows: ReadonlyArray<T>,
): T[] {
  return workflows.filter((workflow) => isTaskUsableWorkflowName(workflow.name))
}
