import type { ExecutorState, TaskViewModel, WorkflowSummary } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  describeWorkflowProgress,
  formatWorkflowDisplayName,
  normalizeWorkflowIdentifier,
  resolveExecutorDisplay,
  resolveWorkflowStepIndex,
} from '../task-execution-display.js'

const WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'builtin',
  stepNames: ['plan', 'implement', 'review'],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

describe('task-execution-display', () => {
  it('resolveWorkflowStepIndex returns -1 when step is unknown', () => {
    expect(resolveWorkflowStepIndex(WORKFLOW, 'missing')).toBe(-1)
  })

  it('resolveExecutorDisplay prefers executor displayName', () => {
    const task = {
      executorAttribution: {
        taskId: 't1',
        executorId: 'agent-external-cursor',
        source: 'workflow-step' as const,
        confidence: 'medium' as const,
      },
    } as TaskViewModel
    const executors: ExecutorState[] = [
      {
        id: 'agent-external-cursor',
        displayName: 'Cursor',
        runtime: 'external',
        status: 'working',
        activeTaskIds: ['t1'],
        updatedAt: '',
      },
    ]
    expect(resolveExecutorDisplay(task, executors).label).toBe('Cursor')
  })

  it('describeWorkflowProgress marks the active step', () => {
    expect(describeWorkflowProgress(['plan', 'implement'], 1)).toContain('implement (running)')
  })

  it('normalizes runtime workflow path to workflow name', () => {
    expect(normalizeWorkflowIdentifier('.orbit/runtime-workflows/default.yaml')).toBe('default')
  })

  it('formats workflow label without internal path details', () => {
    expect(formatWorkflowDisplayName('.orbit/runtime-workflows/dual.yaml')).toBe('dual')
  })
})
