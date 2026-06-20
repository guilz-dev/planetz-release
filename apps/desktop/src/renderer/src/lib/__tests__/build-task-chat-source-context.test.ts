import type { TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { buildTaskChatSourceContext } from '../build-task-chat-source-context.js'

const baseTask: TaskViewModel = {
  id: 'task_abc',
  title: 'Fix login',
  body: 'Investigate the auth regression.',
  workflow: 'debug',
  priority: 'normal',
  status: 'failed',
  source: 'takt',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:01:00.000Z',
  failure: {
    kind: 'failed',
    failedAt: '2026-06-01T00:01:00.000Z',
    message: 'Tests failed on step verify',
    failedStep: 'verify',
  },
}

describe('buildTaskChatSourceContext', () => {
  it('includes task body and failure summary', () => {
    const context = buildTaskChatSourceContext(baseTask)
    expect(context).toContain('task_abc')
    expect(context).toContain('Investigate the auth regression.')
    expect(context).toContain('Tests failed on step verify')
    expect(context).toContain('verify')
  })

  it('handles tasks without failure', () => {
    const context = buildTaskChatSourceContext({
      ...baseTask,
      status: 'pending',
      body: undefined,
      failure: undefined,
    })
    expect(context).toContain('(empty)')
    expect(context).not.toContain('### Failure summary')
  })
})
