import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'

export type ChatEmptyCopyVariant = 'default' | 'clarify-first'

interface ChatEmptyStateProps {
  /** The composer form, rendered centered under the heading. */
  children: ReactNode
  /** Quick-start prompt suggestions; clicking seeds the composer. */
  suggestions?: string[]
  onPickSuggestion?: (text: string) => void
  copyVariant?: ChatEmptyCopyVariant
}

/** New-chat landing state with quick-start suggestions. */
export function ChatEmptyState({
  children,
  suggestions,
  onPickSuggestion,
  copyVariant = 'default',
}: ChatEmptyStateProps) {
  const { t } = useI18n()
  const clarify = copyVariant === 'clarify-first'
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4">
      <h2 className="mb-3 text-center text-2xl font-medium text-[var(--color-text-strong)]">
        {clarify ? t('chat.emptyTitleClarify') : t('chat.emptyTitle')}
      </h2>
      {clarify ? (
        <p className="mb-8 max-w-lg text-center text-sm text-[var(--color-muted-strong)]">
          {t('chat.emptySubtitleClarify')}
        </p>
      ) : (
        <div className="mb-8" />
      )}
      <div className="w-full">{children}</div>
      {suggestions && suggestions.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onPickSuggestion?.(text)}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted-strong)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
