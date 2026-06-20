import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Button } from './ui/button'

export type ComposerSummaryPreviewData = {
  body: string
  allowedActions: Array<'execute' | 'save_task' | 'continue'>
}

export type ComposerSummaryPreviewProps = {
  preview: ComposerSummaryPreviewData
  busy?: boolean
  disabled?: boolean
  onRunNow?: (body: string) => void | Promise<void>
  onFinalize: (body: string) => void | Promise<void>
  onContinue?: () => void
  footer?: ReactNode
}

export function ComposerSummaryPreview({
  preview,
  busy = false,
  disabled = false,
  onRunNow,
  onFinalize,
  onContinue,
  footer,
}: ComposerSummaryPreviewProps) {
  const { t } = useI18n()

  async function handleAction(action: 'execute' | 'save_task' | 'continue') {
    const body = preview.body
    if (action === 'continue') {
      onContinue?.()
      return
    }
    if (action === 'execute' && onRunNow) {
      await onRunNow(body)
      return
    }
    await onFinalize(body)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-[var(--color-muted)]">
        {t('composer.assistSummaryPreview')}
      </p>
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2 text-sm text-[var(--color-text)]">
        {preview.body}
      </pre>
      <div className="flex flex-wrap gap-2">
        {preview.allowedActions.includes('execute') && onRunNow ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || disabled}
            onClick={() => void handleAction('execute')}
          >
            {t('composer.runNow')}
          </Button>
        ) : null}
        {preview.allowedActions.includes('save_task') ? (
          <Button
            type="button"
            variant="subtle"
            size="sm"
            disabled={busy || disabled}
            onClick={() => void handleAction('save_task')}
          >
            {t('composer.assistAddToQueue')}
          </Button>
        ) : null}
        {preview.allowedActions.includes('continue') ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || disabled}
            onClick={() => void handleAction('continue')}
          >
            {t('composer.assistContinueChat')}
          </Button>
        ) : null}
      </div>
      {footer}
    </div>
  )
}
