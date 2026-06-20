import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Dialog } from '../ui/dialog'
import { diffLines } from './workflow-diff.js'

interface DiffDialogProps {
  open: boolean
  title: string
  description?: string
  before: string
  after: string
  confirmLabel?: string
  confirmDisabled?: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function WorkflowDiffDialog({
  open,
  title,
  description,
  before,
  after,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: DiffDialogProps) {
  const lines = diffLines(before, after)
  const hasChanges = lines.some((l) => l.kind !== 'eq')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {onConfirm ? (
            <Button variant="primary" onClick={onConfirm} disabled={!hasChanges || confirmDisabled}>
              {confirmLabel ?? 'Confirm'}
            </Button>
          ) : null}
        </>
      }
    >
      {!hasChanges ? (
        <p className="rounded-md bg-[var(--color-status-completed-soft)] px-3 py-2 text-xs text-[var(--color-status-completed)]">
          No differences.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 font-mono text-[11px]">
          {lines.map((l, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: diff is wholesale-replaced
              key={i}
              className={cn(
                'flex gap-2 whitespace-pre px-3 py-0.5',
                l.kind === 'add' &&
                  'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]',
                l.kind === 'del' &&
                  'bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]',
                l.kind === 'eq' && 'text-[var(--color-muted)]',
              )}
            >
              <span className="select-none opacity-60">
                {l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}
              </span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
