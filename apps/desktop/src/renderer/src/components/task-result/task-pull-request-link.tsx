import type { ResultSummaryPullRequest } from '@planetz/shared'
import { useI18n } from '../../i18n'
import { cn } from '../ui/cn'

interface TaskPullRequestLinkProps {
  pullRequest: ResultSummaryPullRequest
  className?: string
}

export function TaskPullRequestLink({ pullRequest, className }: TaskPullRequestLinkProps) {
  const { t } = useI18n()

  return (
    <a
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      className={cn('text-[11px] text-[var(--color-accent)]', className)}
    >
      {t('panels.result.pullRequestLink', { number: String(pullRequest.number) })}
    </a>
  )
}
