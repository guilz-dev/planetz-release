import {
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  type EnqueueTaskInput,
  resolveTaskIssueNumber,
  resolveTaskIssueRef,
  type TaskViewModel,
  uniqueTaskId,
} from '@planetz/shared'

export function createMockTaskFromEnqueue(
  input: EnqueueTaskInput,
  existingIds: Set<string>,
): TaskViewModel {
  const now = new Date().toISOString()
  return {
    id: uniqueTaskId(input.title, existingIds),
    title: input.title,
    body: input.body,
    issueRef: input.issueRef,
    issueNumber: input.issueNumber,
    workflow: input.workflow ?? COMPOSER_DEFAULT_WORKFLOW_NAME,
    priority: input.priority ?? 'normal',
    status: 'pending',
    assignedAgentId: input.assignedAgentId,
    source: 'user',
    createdAt: now,
    updatedAt: now,
  }
}

interface DerivedTaskInput {
  kind: 'retry' | 'resume' | 'revise'
  origin: TaskViewModel
  prompt?: string
  existingIds: Set<string>
}

const KIND_LABEL: Record<DerivedTaskInput['kind'], string> = {
  retry: 'retry',
  resume: 'resume',
  revise: 'revise',
}

export function createDerivedTask({
  kind,
  origin,
  prompt,
  existingIds,
}: DerivedTaskInput): TaskViewModel {
  const now = new Date().toISOString()
  const title = `${origin.title} (${KIND_LABEL[kind]})`
  const bodyParts: string[] = []
  if (origin.body) bodyParts.push(origin.body)
  if (prompt) bodyParts.push(`\n--- ${KIND_LABEL[kind]} ---\n${prompt}`)
  return {
    id: uniqueTaskId(title, existingIds),
    title,
    body: bodyParts.join('\n').trim() || undefined,
    issueRef: resolveTaskIssueRef(origin),
    issueNumber: resolveTaskIssueNumber(origin),
    workflow: origin.workflow,
    priority: origin.priority,
    status: 'pending',
    assignedAgentId: origin.assignedAgentId,
    source: 'user',
    dependsOnTaskId: origin.id,
    chainId: origin.chainId,
    sourceBranch: kind === 'resume' ? origin.sourceBranch : undefined,
    baseBranch: origin.baseBranch,
    createdAt: now,
    updatedAt: now,
  }
}
