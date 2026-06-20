import type { PromptHistoryItem, TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { indexIssueTaskActivity, issueTaskActivityForRef } from '../issue-task-activity.js'

function makeTask(
  overrides: Partial<TaskViewModel> & Pick<TaskViewModel, 'id' | 'title' | 'status'>,
): TaskViewModel {
  const now = '2026-05-31T00:00:00.000Z'
  return {
    priority: 'normal',
    source: 'takt',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('issue-task-activity', () => {
  it('indexes current tasks and deleted history by canonical issue ref', () => {
    const index = indexIssueTaskActivity(
      [
        makeTask({
          id: 'run-368',
          title: 'Zero-defect gate',
          issueRef: 'guilz-dev/planetz#368',
          issueNumber: 368,
          status: 'running',
        }),
        makeTask({
          id: 'run-361-a',
          title: 'Workflow form',
          issueRef: 'guilz-dev/planetz#361',
          issueNumber: 361,
          status: 'running',
        }),
        makeTask({
          id: 'run-361-b',
          title: 'Workflow form retry',
          issueRef: 'guilz-dev/planetz#361',
          issueNumber: 361,
          status: 'running',
        }),
        makeTask({
          id: 'pending-368',
          title: 'Pending only',
          issueRef: 'guilz-dev/planetz#368',
          issueNumber: 368,
          status: 'pending',
        }),
        makeTask({
          id: 'done-368',
          title: 'Completed issue task',
          issueRef: 'guilz-dev/planetz#368',
          issueNumber: 368,
          status: 'completed',
        }),
        makeTask({
          id: 'composer',
          title: 'Manual composer task',
          status: 'running',
        }),
        makeTask({
          id: 'legacy-362',
          title: '[guilz-dev/planetz#362] Legacy issue task',
          status: 'running',
        }),
      ],
      [
        {
          id: 'prompt-deleted-368',
          title: 'Deleted issue task',
          body: 'body',
          issueRef: 'guilz-dev/planetz#368',
          submittedTaskId: 'deleted-368',
          status: 'submitted',
          createdAt: '2026-05-31T00:00:00.000Z',
          updatedAt: '2026-05-31T00:00:00.000Z',
        } satisfies PromptHistoryItem,
        {
          id: 'prompt-other-repo-368',
          title: 'Other repo issue task',
          body: 'body',
          issueRef: 'other/board#368',
          submittedTaskId: 'other-368',
          status: 'submitted',
          createdAt: '2026-05-31T00:00:00.000Z',
          updatedAt: '2026-05-31T00:00:00.000Z',
        } satisfies PromptHistoryItem,
      ],
    )

    expect(issueTaskActivityForRef(index, { owner: 'guilz-dev', name: 'planetz' }, 368)).toEqual({
      totalCount: 4,
      runningCount: 1,
      queuedCount: 1,
    })
    expect(issueTaskActivityForRef(index, { owner: 'guilz-dev', name: 'planetz' }, 361)).toEqual({
      totalCount: 2,
      runningCount: 2,
      queuedCount: 0,
    })
    expect(issueTaskActivityForRef(index, { owner: 'guilz-dev', name: 'planetz' }, 362)).toEqual({
      totalCount: 1,
      runningCount: 1,
      queuedCount: 0,
    })
    expect(issueTaskActivityForRef(index, { owner: 'guilz-dev', name: 'planetz' }, 367)).toEqual({
      totalCount: 0,
      runningCount: 0,
      queuedCount: 0,
    })
    expect(issueTaskActivityForRef(index, { owner: 'other', name: 'board' }, 368)).toEqual({
      totalCount: 1,
      runningCount: 0,
      queuedCount: 0,
    })
  })
})
