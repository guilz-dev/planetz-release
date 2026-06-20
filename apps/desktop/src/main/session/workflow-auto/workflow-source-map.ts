import type { WorkflowSource, WorkflowSummary } from '@planetz/shared'

export function buildWorkflowSourceMap(
  workflows: ReadonlyArray<Pick<WorkflowSummary, 'name' | 'source'>>,
): Map<string, WorkflowSource> {
  return new Map(workflows.map((workflow) => [workflow.name, workflow.source]))
}
