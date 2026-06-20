import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useConversationSession } from '../hooks/use-conversation-session'
import { useI18n } from '../i18n'
import { ComposerSummaryPreview } from './composer-summary-preview'
import { BusyPlaceholder } from './ui/busy-placeholder'
import { Button } from './ui/button'
import { Textarea } from './ui/input'

interface ComposerAssistPanelProps {
  seedBody: string
  workflow: string
  provider?: string
  model?: string
  /** Untrusted Source Context block (Issue/PR) injected into the assist session. */
  sourceContext?: string
  /** Origin reference shown as a note (e.g. `owner/repo#123`). */
  sourceContextRef?: string
  disabled?: boolean
  onFinalize: (body: string) => void | Promise<void>
  onRunNow?: (body: string) => void | Promise<void>
  onBackToDirect: () => void
}

export function ComposerAssistPanel({
  seedBody,
  workflow,
  provider,
  model,
  sourceContext,
  sourceContextRef,
  disabled = false,
  onFinalize,
  onRunNow,
  onBackToDirect,
}: ComposerAssistPanelProps) {
  const { t } = useI18n()
  const session = useConversationSession({
    seedBody,
    workflow,
    provider,
    model,
    sourceContext,
    disabled,
    onFinalize,
    onRunNow,
  })

  const turnsScrollRef = useRef<HTMLDivElement | null>(null)
  const transcriptLength = session.turns.length + session.conversation.length

  useEffect(() => {
    const node = turnsScrollRef.current
    if (!node || transcriptLength === 0) return
    node.scrollTop = node.scrollHeight
  }, [transcriptLength])

  async function handleBackToDirect() {
    await session.cancelSession()
    onBackToDirect()
  }

  const sourceContextNote = sourceContext?.trim()
    ? sourceContextRef?.trim()
      ? t('composer.assistSourceContextNote', { ref: sourceContextRef.trim() })
      : t('composer.assistSourceContextNoteGeneric')
    : null

  const closeAssistButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t('composer.assistBackToDirect')}
      disabled={session.busy}
      onClick={() => void handleBackToDirect()}
    >
      <X size={14} aria-hidden className="mr-1" />
      {t('composer.assistBackToDirect')}
    </Button>
  )

  if (session.initialLoading) {
    return (
      <div className="flex flex-col gap-2">
        <BusyPlaceholder label={t('composer.assistStarting')} />
        <div className="flex justify-end">{closeAssistButton}</div>
      </div>
    )
  }

  if (session.summaryPreview) {
    return (
      <div className="flex flex-col gap-2">
        <ComposerSummaryPreview
          preview={session.summaryPreview}
          busy={session.busy}
          disabled={disabled}
          onRunNow={onRunNow}
          onFinalize={onFinalize}
          onContinue={session.dismissSummaryPreview}
          footer={<div className="flex justify-end">{closeAssistButton}</div>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sourceContextNote ? (
        <p className="truncate text-xs text-[var(--color-muted)]" title={sourceContextNote}>
          {sourceContextNote}
        </p>
      ) : null}
      <div
        ref={turnsScrollRef}
        className="max-h-40 min-h-[3.5rem] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2"
      >
        {session.resumedDraft ? (
          <p className="mb-2 text-xs text-[var(--color-muted)]">{t('composer.assistResumed')}</p>
        ) : null}
        {session.useConversationUi ? (
          <ul className="flex flex-col gap-2">
            {session.conversation.map((line) => (
              <li key={line.id} className="text-sm text-[var(--color-text)]">
                <span className="font-medium text-[var(--color-muted)]">
                  {line.role === 'user' ? t('composer.assistYou') : t('composer.assistAssistant')}:{' '}
                </span>
                {line.content}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2">
            {session.turns.map((turn) => (
              <li key={turn.id} className="flex flex-col gap-1 text-sm">
                <p className="text-[var(--color-text)]">
                  <span className="font-medium text-[var(--color-muted)]">Q: </span>
                  {turn.question}
                </p>
                <button
                  type="button"
                  className="w-fit rounded-md border border-[var(--color-border)] px-2 py-0.5 text-left text-xs text-[var(--color-accent)] hover:bg-[var(--color-panel-strong)]"
                  disabled={session.busy || disabled || !!turn.userReply}
                  onClick={() => session.setReply(turn.recommendedAnswer)}
                >
                  {t('composer.assistSuggested')}: {turn.recommendedAnswer}
                </button>
                {turn.userReply ? (
                  <p className="text-[var(--color-text)]">
                    <span className="font-medium text-[var(--color-muted)]">A: </span>
                    {turn.userReply}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Textarea
        placeholder={
          session.useConversationUi
            ? t('composer.assistMessagePlaceholder')
            : t('composer.assistReplyPlaceholder')
        }
        value={session.reply}
        disabled={session.busy || disabled || !session.sessionId}
        onChange={(e) => session.setReply(e.target.value)}
        rows={2}
      />
      {session.compactionNotice ? (
        <p className="w-full text-xs text-[var(--color-muted)]">{session.compactionNotice}</p>
      ) : null}
      {session.error ? (
        <div className="flex flex-wrap gap-2">
          <p className="w-full text-xs text-[var(--color-alert)]">{session.error}</p>
          {session.retryableAction ? (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              disabled={session.busy}
              onClick={session.retry}
            >
              {t('composer.assistRetry')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleBackToDirect()}>
            {t('composer.assistContinueDirect')}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="subtle"
            size="sm"
            loading={session.busyAction === 'send'}
            disabled={disabled || !session.sessionId || !session.reply.trim()}
            onClick={() => void session.sendReply(session.reply)}
          >
            {t('composer.assistSend')}
          </Button>
          {session.canUseAcceptPlay ? (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              loading={session.busyAction === 'play'}
              disabled={disabled || !session.sessionId || !session.reply.trim()}
              onClick={() => void session.play(session.reply)}
            >
              {t('composer.assistRunInstruction')}
            </Button>
          ) : null}
          {session.canUseAcceptPlay ? (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              loading={session.busyAction === 'accept'}
              disabled={disabled || !session.sessionId}
              onClick={() => void session.accept()}
            >
              {t('composer.assistUseLatest')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={session.busyAction === 'finalize'}
            disabled={
              disabled ||
              !session.sessionId ||
              (!session.readyToFinalize &&
                session.turns.length === 0 &&
                session.conversation.length === 0)
            }
            onClick={() => void session.finalize()}
          >
            {t('composer.assistFinalize')}
          </Button>
        </div>
        {closeAssistButton}
      </div>
    </div>
  )
}
