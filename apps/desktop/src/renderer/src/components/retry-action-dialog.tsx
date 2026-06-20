import type { TaskViewModel } from '@planetz/shared'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Textarea } from './ui/input'

export type RetryAction = 'retry' | 'resume' | 'revise'

const ACTION_COPY: Record<
  RetryAction,
  { title: string; description: string; submit: string; placeholder?: string; needsPrompt: boolean }
> = {
  retry: {
    title: 'Retry with the same order',
    description: 'Submit the same order.md again as a fresh pending task.',
    submit: 'Retry task',
    needsPrompt: false,
  },
  resume: {
    title: 'Resume from where it stopped',
    description:
      'Carry the previous branch and logs forward; add notes on how to continue. v0.2 is resume-like (a new task is created with context inlined).',
    submit: 'Resume task',
    placeholder: 'Fix the failing tests, then continue from the current diff…',
    needsPrompt: true,
  },
  revise: {
    title: 'Revise the order',
    description: 'Change direction. Provide added instructions that build on the original order.',
    submit: 'Create revised task',
    placeholder: 'Use cookies instead of localStorage for the session…',
    needsPrompt: true,
  },
}

interface RetryActionDialogProps {
  open: boolean
  action: RetryAction | null
  task: TaskViewModel | null
  busy: boolean
  onClose: () => void
  onConfirm: (prompt: string) => Promise<void>
}

export function RetryActionDialog({
  open,
  action,
  task,
  busy,
  onClose,
  onConfirm,
}: RetryActionDialogProps) {
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    if (open) setPrompt('')
  }, [open])

  if (!action || !task) {
    return null
  }

  const copy = ACTION_COPY[action]
  const canSubmit = !busy && (!copy.needsPrompt || prompt.trim().length > 0)

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={copy.title}
      description={
        <>
          Target task: <span className="font-mono text-[var(--color-text)]">{task.id}</span>
        </>
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => void onConfirm(prompt.trim())}
          >
            {busy ? 'Working…' : copy.submit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-[var(--color-muted-strong)]">{copy.description}</p>
        {task.body ? (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Original order
            </p>
            <pre className="max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-[var(--color-text)]">
              {task.body}
            </pre>
          </div>
        ) : null}
        {copy.needsPrompt ? (
          <label htmlFor="retry-action-prompt" className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              {action === 'resume' ? 'Continuation notes' : 'Revised instructions'}
            </span>
            <Textarea
              id="retry-action-prompt"
              autoFocus
              placeholder={copy.placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
          </label>
        ) : null}
      </div>
    </Dialog>
  )
}
