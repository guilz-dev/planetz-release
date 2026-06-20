import type { TaskViewModel, TaskWorkflowSelectionView } from '@planetz/shared'
import type { TaskWorkflowSelectionMetaRow } from '../../storage/sqlite/repositories/task-workflow-selection-meta-repository.js'

function toWorkflowSelectionView(row: TaskWorkflowSelectionMetaRow): TaskWorkflowSelectionView {
  const displayWorkflow = row.resolvedWorkflow ?? row.baseWorkflow
  const displayLabel = row.kind === 'modified' ? `${row.baseWorkflow} (modified)` : displayWorkflow
  return {
    kind: row.kind,
    baseWorkflow: row.baseWorkflow,
    displayLabel,
  }
}

export function attachWorkflowSelectionMeta(
  tasks: TaskViewModel[],
  metaByTaskId: ReadonlyMap<string, TaskWorkflowSelectionMetaRow>,
): TaskViewModel[] {
  if (metaByTaskId.size === 0) return tasks
  return tasks.map((task) => {
    const row = metaByTaskId.get(task.id)
    if (!row) return task
    const workflowSelection = toWorkflowSelectionView(row)
    const workflow = row.resolvedWorkflow ?? task.workflow ?? row.baseWorkflow
    return {
      ...task,
      workflow,
      workflowSelection,
    }
  })
}
