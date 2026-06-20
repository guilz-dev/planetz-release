import {
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  filterUserVisibleWorkflows,
  ORBIT_DISPLAY_NAME,
  type TaskViewModel,
  type WorkflowSummary,
} from '@planetz/shared'
import { GitBranch, GitMerge } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { resolveComposerWorkflowName } from '../lib/composer-workflow-selection.js'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Dialog } from './ui/dialog'
import { Field, Input, Textarea } from './ui/input'
import { Select } from './ui/select'

type Mode = 'branch_handoff' | 'merge_then_continue'

interface ChainCreateDialogProps {
  open: boolean
  origin: TaskViewModel | null
  workflows: WorkflowSummary[]
  busy: boolean
  onClose: () => void
  onConfirm: (input: {
    title: string
    body: string
    workflow: string
    mode: Mode
    sourceBranch?: string
    baseBranch?: string
  }) => Promise<void>
}

export function ChainCreateDialog({
  open,
  origin,
  workflows,
  busy,
  onClose,
  onConfirm,
}: ChainCreateDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [workflow, setWorkflow] = useState(COMPOSER_DEFAULT_WORKFLOW_NAME)
  const [mode, setMode] = useState<Mode>('branch_handoff')
  const [baseBranch, setBaseBranch] = useState('main')
  const preserveWorkflowName = origin?.workflow?.trim()
  const selectableWorkflows = useMemo(
    () =>
      filterUserVisibleWorkflows(workflows, {
        preserveSelectedName: preserveWorkflowName,
      }),
    [workflows, preserveWorkflowName],
  )

  useEffect(() => {
    if (open && origin) {
      setTitle('')
      setBody('')
      setWorkflow(
        origin.workflow ??
          resolveComposerWorkflowName(selectableWorkflows, COMPOSER_DEFAULT_WORKFLOW_NAME),
      )
      setMode('branch_handoff')
      setBaseBranch(origin.baseBranch ?? 'main')
    }
  }, [open, origin, selectableWorkflows])

  if (!open || !origin) return null

  const sourceBranch = origin.sourceBranch ?? `${origin.id}-output`

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Create dependent task"
      description={
        <>
          Chained after <span className="font-mono text-[var(--color-text)]">{origin.id}</span>.{' '}
          {ORBIT_DISPLAY_NAME}&apos;s workflow step chain is preferred for inside-one-task flow;
          this UI handles cross-task handoff (v0.3 §6.10).
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
            disabled={busy || !title.trim()}
            onClick={() =>
              void onConfirm({
                title: title.trim(),
                body: body.trim(),
                workflow,
                mode,
                sourceBranch: mode === 'branch_handoff' ? sourceBranch : undefined,
                baseBranch,
              })
            }
          >
            {busy ? 'Reserving…' : 'Reserve chain'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Title">
          <Input
            placeholder="What should the next agent do?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Order">
          <Textarea
            placeholder="Add the additional context needed to continue from the previous branch."
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Workflow">
            <Select fullWidth value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
              {selectableWorkflows.map((wf) => (
                <option key={wf.name} value={wf.name}>
                  {wf.name} ({wf.source})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Base branch">
            <Input value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
          <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Chain mode
          </legend>
          <ModeRadio
            checked={mode === 'branch_handoff'}
            onChange={() => setMode('branch_handoff')}
            icon={<GitBranch size={14} />}
            label="branch_handoff"
            body={
              <>
                Run the next task directly on{' '}
                <span className="font-mono text-[var(--color-text)]">{sourceBranch}</span> without
                merging first. Experimental in v0.3.
              </>
            }
          />
          <ModeRadio
            checked={mode === 'merge_then_continue'}
            onChange={() => setMode('merge_then_continue')}
            icon={<GitMerge size={14} />}
            label="merge_then_continue"
            body={
              <>
                Merge the previous branch into{' '}
                <span className="font-mono text-[var(--color-text)]">{baseBranch}</span> first (the
                human confirms), then start the next task from there.
              </>
            }
          />
        </fieldset>
      </div>
    </Dialog>
  )
}

interface ModeRadioProps {
  checked: boolean
  onChange: () => void
  icon: React.ReactNode
  label: string
  body: React.ReactNode
}

function ModeRadio({ checked, onChange, icon, label, body }: ModeRadioProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors',
        checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
      )}
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        onChange={onChange}
        name="chain-mode"
      />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text)]">
          {icon}
          <span className="font-mono">{label}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--color-muted-strong)]">{body}</p>
      </div>
    </label>
  )
}
