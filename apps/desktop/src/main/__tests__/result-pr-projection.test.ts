import { describe, expect, it } from 'vitest'
import {
  enrichResultSummariesWithPullRequests,
  taskPrLinksToMap,
} from '../lib/projection/result-pr-projection.js'

describe('result-pr-projection', () => {
  it('enriches matching result summaries with pull request links', () => {
    const results = [
      { taskId: 't1', title: 'One', status: 'completed' as const, branch: 'feat/a' },
      { taskId: 't2', title: 'Two', status: 'completed' as const, branch: 'feat/b' },
    ]
    const linksByTaskId = taskPrLinksToMap([
      {
        taskId: 't1',
        branch: 'feat/a',
        repo: 'o/r',
        number: 42,
        url: 'https://github.com/o/r/pull/42',
        state: 'open',
        isDraft: false,
        baseBranch: 'main',
        updatedAt: '2026-05-31T00:00:00.000Z',
      },
    ])

    expect(enrichResultSummariesWithPullRequests(results, linksByTaskId)).toEqual([
      {
        ...results[0],
        pullRequest: {
          number: 42,
          url: 'https://github.com/o/r/pull/42',
          state: 'open',
          isDraft: false,
        },
      },
      results[1],
    ])
  })
})
