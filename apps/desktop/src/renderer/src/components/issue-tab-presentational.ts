import type { GitHubIssueErrorCode } from '@planetz/shared'
import type { I18nKey } from '../i18n/catalog.js'

export const ISSUE_BODY_PREVIEW_LINE_COUNT = 3

export const ISSUE_ERROR_I18N_KEYS: Record<GitHubIssueErrorCode, I18nKey> = {
  gh_not_found: 'views.issue.errors.gh_not_found',
  gh_auth_required: 'views.issue.errors.gh_auth_required',
  invalid_issue_ref: 'views.issue.errors.invalid_issue_ref',
  repo_required: 'views.issue.errors.repo_required',
  issue_not_found: 'views.issue.errors.issue_not_found',
  permission_denied: 'views.issue.errors.permission_denied',
  unexpected_failure: 'views.issue.errors.unexpected_failure',
}

export function issueErrorMessage(t: (key: I18nKey) => string, code: GitHubIssueErrorCode): string {
  return t(ISSUE_ERROR_I18N_KEYS[code])
}

export function issueBodyPreviewLines(body: string, lineCount: number): string {
  return body.split('\n').slice(0, lineCount).join('\n')
}

export function issueErrorRecoveryCommand(code: GitHubIssueErrorCode | null): string | null {
  if (code === 'gh_auth_required') return 'gh auth login'
  if (code === 'gh_not_found') return 'gh --version'
  return null
}

export function formatIssueRepoSlug(owner: string, name: string): string {
  return `${owner}/${name}`
}
