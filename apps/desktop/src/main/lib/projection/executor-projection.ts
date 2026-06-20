import type { AgentState, ExecutorState, TaskViewModel } from '@planetz/shared'
import { providerToExecutorId } from '@planetz/shared'

function displayNameForOrphanExecutor(executorId: string): string {
  if (executorId.includes('cursor')) return 'Cursor (inferred)'
  if (executorId.includes('codex')) return 'Codex (inferred)'
  if (executorId.includes('claude')) return 'Claude (inferred)'
  return `${executorId} (inferred)`
}

export function projectExecutorsFromAttributions(
  templates: AgentState[],
  tasks: TaskViewModel[],
): ExecutorState[] {
  const now = new Date().toISOString()
  const byId = new Map<string, ExecutorState>()

  for (const template of templates) {
    byId.set(template.id, {
      id: template.id,
      displayName: template.displayName,
      runtime: template.runtime,
      status: 'idle',
      activeTaskIds: [],
      updatedAt: now,
    })
  }

  for (const task of tasks) {
    const attr = task.executorAttribution
    const executorId = attr?.executorId
    if (!executorId || task.status !== 'running') continue

    const existing = byId.get(executorId)
    if (existing) {
      existing.status = 'working'
      existing.activeTaskIds.push(task.id)
      if (task.activeRunId) {
        existing.activeRunIds = [...(existing.activeRunIds ?? []), task.activeRunId]
      }
      existing.updatedAt = now
    } else {
      byId.set(executorId, {
        id: executorId,
        displayName: displayNameForOrphanExecutor(executorId),
        runtime: executorId.includes('external') ? 'external' : 'takt',
        status: 'working',
        activeTaskIds: [task.id],
        activeRunIds: task.activeRunId ? [task.activeRunId] : undefined,
        updatedAt: now,
      })
    }
  }

  return [...byId.values()]
}

export function executorsToAgentStates(
  executors: ExecutorState[],
  templateById: Map<string, AgentState>,
): AgentState[] {
  const now = new Date().toISOString()
  return executors.map((executor) => {
    const template = templateById.get(executor.id)
    return {
      id: executor.id,
      displayName: executor.displayName,
      runtime: executor.runtime,
      role: template?.role ?? 'custom',
      status: executor.status,
      currentTaskId: executor.activeTaskIds[0],
      currentRunId: executor.activeRunIds?.[0],
      logTail: template?.logTail ?? [],
      updatedAt: now,
    }
  })
}

export function resolveExecutorIdFromProfile(provider: string | undefined): string | undefined {
  return providerToExecutorId(provider)
}
