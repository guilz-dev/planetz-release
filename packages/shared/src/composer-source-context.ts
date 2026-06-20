import { COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS } from './constants.js'
import type { GitHubIssueView } from './github-issue-types.js'

const SOURCE_CONTEXT_TRUNCATION_MARKER = '\n\n[Source context truncated due to size limit]\n'

/** Truncate oversized source context before IPC, runner, or sidecar persistence. */
export function normalizeComposerAssistSourceContext(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS) {
    return trimmed
  }
  const budget = Math.max(
    0,
    COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS - SOURCE_CONTEXT_TRUNCATION_MARKER.length,
  )
  return `${trimmed.slice(0, budget)}${SOURCE_CONTEXT_TRUNCATION_MARKER}`
}

/** Minimal PR review payload for Composer Assist source context (UI may supply later). */
export interface GitHubPrReviewSourceView {
  repository: { owner: string; name: string }
  number: number
  title: string
  url: string
  body?: string
}

/**
 * Orbit-aligned issue source context (untrusted reference block).
 * Matches `formatIssueAsTask` structure without comments until fetch includes them.
 */
export function formatGitHubIssueAsSourceContext(issue: GitHubIssueView): string {
  const parts: string[] = []
  parts.push(`## Issue #${issue.number}: ${issue.title}`)
  if (issue.body.trim()) {
    parts.push('', issue.body.trim())
  }
  if (issue.labels.length > 0) {
    parts.push('', '### Labels', issue.labels.join(', '))
  }
  parts.push('', '### Reference', issue.url)
  return parts.join('\n')
}

/** PR review source context for interactive mode (untrusted reference block). */
export function formatGitHubPrAsSourceContext(pr: GitHubPrReviewSourceView): string {
  const repoSlug = `${pr.repository.owner}/${pr.repository.name}`
  const parts = [`## Pull Request #${pr.number}: ${pr.title}`, '', `Repository: ${repoSlug}`]
  if (pr.body?.trim()) {
    parts.push('', pr.body.trim())
  }
  parts.push('', '### Reference', pr.url)
  return parts.join('\n')
}
