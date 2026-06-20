import type { ResultSummary } from '@planetz/shared'
import type { TaskPrLinkRecord } from '../../sidecar/task-pr-link-store.js'

export function enrichResultSummariesWithPullRequests(
  results: ResultSummary[],
  linksByTaskId: ReadonlyMap<string, TaskPrLinkRecord>,
): ResultSummary[] {
  if (linksByTaskId.size === 0) return results
  return results.map((result) => {
    const link = linksByTaskId.get(result.taskId)
    if (!link) return result
    return {
      ...result,
      pullRequest: {
        number: link.number,
        url: link.url,
        state: link.state,
        isDraft: link.isDraft,
      },
    }
  })
}

export function taskPrLinksToMap(links: TaskPrLinkRecord[]): Map<string, TaskPrLinkRecord> {
  return new Map(links.map((link) => [link.taskId, link]))
}
