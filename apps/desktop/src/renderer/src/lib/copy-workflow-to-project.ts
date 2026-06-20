import type { WorkflowSummary } from '@planetz/shared'

export function projectWorkflowExists(
  name: string,
  workflows: ReadonlyArray<Pick<WorkflowSummary, 'name' | 'source'>>,
  alsoProjectNames?: ReadonlySet<string>,
): boolean {
  if (alsoProjectNames?.has(name)) return true
  return workflows.some((workflow) => workflow.name === name && workflow.source === 'project')
}

export async function copyWorkflowToProject(input: {
  name: string
  workflows: ReadonlyArray<Pick<WorkflowSummary, 'name' | 'source'>>
  alsoProjectNames?: ReadonlySet<string>
  confirmOverwrite: (name: string) => Promise<boolean>
}): Promise<'copied' | 'cancelled' | 'failed'> {
  const trimmed = input.name.trim()
  if (!trimmed) return 'failed'

  if (projectWorkflowExists(trimmed, input.workflows, input.alsoProjectNames)) {
    const approved = await input.confirmOverwrite(trimmed)
    if (!approved) return 'cancelled'
  }

  try {
    const res = await window.orbit.readWorkflow({ nameOrPath: trimmed })
    await window.orbit.writeProjectWorkflow({ name: trimmed, yaml: res.yaml })
    return 'copied'
  } catch {
    return 'failed'
  }
}
