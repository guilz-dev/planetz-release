import {
  type EnqueueTaskInput,
  resolveTaskIssueNumber,
  resolveTaskIssueRef,
  type TaskViewModel,
} from '@planetz/shared'

/** Build enqueue input from a pending task row before run / S5 facet regeneration. */
export function taskViewModelToRuntimeEnqueueInput(task: TaskViewModel): EnqueueTaskInput {
  return {
    title: task.title,
    body: task.body && task.body.trim().length > 0 ? task.body : task.title,
    ...(task.workflow ? { workflow: task.workflow } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
    ...(task.assignedAgentId ? { assignedAgentId: task.assignedAgentId } : {}),
  }
}

/** Build enqueue input for retry / resume / revise derived tasks. */
export function buildDeriveEnqueueInput(
  origin: TaskViewModel,
  kind: 'retry' | 'resume' | 'revise',
  prompt?: string,
): EnqueueTaskInput {
  const issueRef = resolveTaskIssueRef(origin)
  const issueNumber = resolveTaskIssueNumber(origin)
  return {
    title: `${origin.title} (${kind})`,
    body: [origin.body, prompt ? `\n--- ${kind} ---\n${prompt}` : ''].filter(Boolean).join('\n'),
    ...(issueRef ? { issueRef } : {}),
    ...(issueNumber ? { issueNumber } : {}),
    ...(origin.workflow ? { workflow: origin.workflow } : {}),
    ...(origin.priority ? { priority: origin.priority } : {}),
  }
}
