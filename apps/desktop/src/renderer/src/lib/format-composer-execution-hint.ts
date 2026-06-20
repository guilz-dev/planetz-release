import type { ComposerExecutionHint, OllamaWorkflowCompatIssue } from '@planetz/shared'
import type { TranslateFn } from '../i18n/index.js'
import { formatOllamaGuardIssues } from './format-ollama-guard-issues.js'

function formatStepConflictList(hint: ComposerExecutionHint, t: TranslateFn): string {
  return hint.conflicts
    .map((c) =>
      t('composer.executionHint.stepLine', {
        step: c.stepName,
        provider: c.stepProvider,
      }),
    )
    .join(' ')
}

/** User-facing banner for Add Task provider vs workflow step provider mismatch. */
export function formatComposerStepProviderHint(
  hint: ComposerExecutionHint,
  t: TranslateFn,
): string {
  const providers = hint.effectiveStepProviders.join(', ')
  const intro =
    hint.taskProvider === 'ollama'
      ? t('composer.executionHint.ollamaStepOverrideIntro', { providers })
      : t('composer.executionHint.stepOverrideIntro', {
          taskProvider: hint.taskProvider,
          providers,
        })
  return `${intro} ${formatStepConflictList(hint, t)}`.trim()
}

export function formatComposerOllamaToolsHint(
  issues: OllamaWorkflowCompatIssue[],
  t: TranslateFn,
): string {
  return `${t('composer.executionHint.ollamaToolsIntro')} ${formatOllamaGuardIssues(issues, t)}`.trim()
}

export function formatComposerAutoModeHint(t: TranslateFn): string {
  return t('composer.executionHint.autoModeOverride')
}
