import { ListPlus } from 'lucide-react'

interface ChatAddToTaskButtonProps {
  label: string
  ariaLabel?: string
  onClick: () => void
}

/**
 * Icon-only "Add to task" hand-off button. The visible `label` is intentionally
 * unused — the icon carries the meaning, and the `ariaLabel` describes the
 * action to assistive tech. The prop is kept for backwards compatibility with
 * existing callers.
 */
export function ChatAddToTaskButton({ label, ariaLabel, onClick }: ChatAddToTaskButtonProps) {
  void label
  return (
    <button
      type="button"
      title={ariaLabel ?? 'Add to task'}
      aria-label={ariaLabel ?? 'Add to task'}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text)]"
    >
      <ListPlus size={13} aria-hidden />
    </button>
  )
}
