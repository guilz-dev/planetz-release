import { describe, expect, it } from 'vitest'
import {
  buildDeriveEnqueueInput,
  taskViewModelToRuntimeEnqueueInput,
} from '../task-enqueue-input.js'

describe('task-enqueue-input', () => {
  it('taskViewModelToRuntimeEnqueueInput falls back body to title', () => {
    expect(
      taskViewModelToRuntimeEnqueueInput({
        id: 't1',
        title: 'Run me',
        body: '   ',
        priority: 'normal',
        status: 'pending',
        source: 'user',
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-10T00:00:00.000Z',
        workflow: 'default',
      }),
    ).toEqual({
      title: 'Run me',
      body: 'Run me',
      workflow: 'default',
      priority: 'normal',
    })
  })

  it('buildDeriveEnqueueInput includes issue metadata and prompt section', () => {
    expect(
      buildDeriveEnqueueInput(
        {
          id: 't1',
          title: 'Origin',
          body: 'Body',
          priority: 'normal',
          status: 'failed',
          source: 'user',
          createdAt: '2026-06-10T00:00:00.000Z',
          updatedAt: '2026-06-10T00:00:00.000Z',
          issueNumber: 42,
        },
        'retry',
        'Try again',
      ),
    ).toEqual({
      title: 'Origin (retry)',
      body: 'Body\n\n--- retry ---\nTry again',
      issueNumber: 42,
      priority: 'normal',
    })
  })
})
