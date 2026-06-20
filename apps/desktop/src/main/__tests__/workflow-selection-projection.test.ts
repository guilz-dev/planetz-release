import { describe, expect, it } from 'vitest'
import { attachWorkflowSelectionMeta } from '../lib/projection/workflow-selection-projection.js'

describe('attachWorkflowSelectionMeta', () => {
  it('projects workflow selection onto tasks', () => {
    const tasks = [
      {
        id: 't1',
        title: 'Task',
        priority: 'normal' as const,
        status: 'pending' as const,
        source: 'user' as const,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        workflow: 'minimal',
      },
    ]
    const meta = new Map([
      [
        't1',
        {
          taskId: 't1',
          updatedAt: '2026-01-01',
          kind: 'auto' as const,
          baseWorkflow: 'minimal',
          resolvedWorkflow: 'minimal',
        },
      ],
    ])
    const projected = attachWorkflowSelectionMeta(tasks, meta)
    expect(projected[0]?.workflowSelection?.kind).toBe('auto')
    expect(projected[0]?.workflowSelection?.displayLabel).toBe('minimal')
  })
})
