import {
  type ComposerSourceContextBuildInput,
  type ComposerSourceContextBuildResult,
  formatGitHubIssueAsSourceContext,
  formatGitHubPrAsSourceContext,
  normalizeComposerAssistSourceContext,
  redactSecrets,
} from '@planetz/shared'
import type { GitHubIssueService } from './github-issue-service.js'

export interface ComposerSourceContextBuilderDeps {
  githubIssueService: GitHubIssueService
  workspacePath: string | null
}

export async function buildComposerSourceContext(
  deps: ComposerSourceContextBuilderDeps,
  input: ComposerSourceContextBuildInput,
): Promise<ComposerSourceContextBuildResult> {
  if (input.kind === 'issue') {
    const issue = await deps.githubIssueService.fetch(
      { ref: input.ref },
      { workspacePath: deps.workspacePath },
    )
    return {
      sourceContext: normalizeComposerAssistSourceContext(
        redactSecrets(formatGitHubIssueAsSourceContext(issue)),
      ),
    }
  }

  return {
    sourceContext: normalizeComposerAssistSourceContext(
      redactSecrets(
        formatGitHubPrAsSourceContext({
          repository: input.repository,
          number: input.number,
          title: input.title,
          url: input.url,
          body: input.body,
        }),
      ),
    ),
  }
}
