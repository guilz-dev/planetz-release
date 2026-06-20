export function workflowChangeClearingRunOverride(
  workflow: string,
  setRunOverride: (override: undefined) => void,
  setSelectedWorkflow: (workflow: string) => void,
): void {
  setRunOverride(undefined)
  setSelectedWorkflow(workflow)
}
