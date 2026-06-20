import type { TaskViewModel } from '@planetz/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../app-store.js'

const task: TaskViewModel = {
  id: 'implement-auth-core',
  title: 'Implement auth',
  status: 'running',
  priority: 'normal',
  source: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  workflow: 'default',
  executorAttribution: {
    taskId: 'implement-auth-core',
    executorId: 'cursor',
    source: 'workflow-step',
    confidence: 'medium',
  },
}

describe('useAppStore openExecutionLogForTask', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeView: 'task',
      executionLogPreset: null,
      executorFilterByView: {},
    })
  })

  it('switches to log view and sets a one-shot filter preset', () => {
    useAppStore.getState().openExecutionLogForTask(task)
    const s = useAppStore.getState()
    expect(s.activeView).toBe('log')
    expect(s.executionLogPreset).toEqual({
      keyword: 'implement-auth-core',
      taskStatus: 'all',
      executorId: 'cursor',
    })
  })

  it('falls back to assignedAgentId for executor filter', () => {
    const withoutAttribution = {
      ...task,
      executorAttribution: undefined,
      assignedAgentId: 'agent-coder',
    }
    useAppStore.getState().openExecutionLogForTask(withoutAttribution)
    expect(useAppStore.getState().executionLogPreset?.executorId).toBe('agent-coder')
  })

  it('openExecutionLogForFailure prefers runId and all-time window', () => {
    const failed = {
      ...task,
      status: 'failed' as const,
      failure: {
        failedAt: new Date().toISOString(),
        kind: 'failed' as const,
        runId: 'run-fail:session-1',
      },
    }
    useAppStore.getState().openExecutionLogForFailure(failed)
    const preset = useAppStore.getState().executionLogPreset
    expect(preset).toEqual({
      runId: 'run-fail:session-1',
      window: 'all',
      taskStatus: 'failed',
      executorId: 'cursor',
    })
  })

  it('openExecutionLogForFailure falls back to task id keyword when runId is missing', () => {
    const failed = {
      ...task,
      status: 'failed' as const,
      failure: {
        failedAt: new Date().toISOString(),
        kind: 'failed' as const,
      },
    }
    useAppStore.getState().openExecutionLogForFailure(failed)
    expect(useAppStore.getState().executionLogPreset).toEqual({
      keyword: 'implement-auth-core',
      window: 'all',
      taskStatus: 'failed',
      executorId: 'cursor',
    })
  })

  it('keeps task and log executor filters independent', () => {
    useAppStore.getState().setExecutorFilter('task', 'agent-a')
    useAppStore.getState().setExecutorFilter('log', 'agent-b')
    expect(useAppStore.getState().executorFilterByView).toEqual({
      task: 'agent-a',
      log: 'agent-b',
    })
  })
})
