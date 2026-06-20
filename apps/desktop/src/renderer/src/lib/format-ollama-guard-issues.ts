import type { OllamaWorkflowCompatIssue } from '@planetz/shared'
import type { I18nKey, TranslateFn } from '../i18n/index.js'

/** User-facing message for Ollama workflow guard issues (i18n). */
export function formatOllamaGuardIssues(
  issues: OllamaWorkflowCompatIssue[],
  t: TranslateFn,
): string {
  if (issues.length === 0) {
    return t('settings.ollama.guard.summary')
  }
  return issues
    .map((issue) => {
      const key = `settings.ollama.guard.${issue.kind}` as I18nKey
      const translated = t(key, { step: issue.stepName })
      return translated === key ? `${issue.stepName}: ${issue.kind}` : translated
    })
    .join(' ')
}
