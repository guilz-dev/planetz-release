import { Field, Input, Textarea } from '../ui/input'
import { Select } from '../ui/select'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { validateInitialStep, validateWorkflowName } from './workflow-name-utils.js'

export interface WorkflowEditorOverviewTabProps {
  draft: WorkflowDraft
  setDraft: (next: WorkflowDraft) => void
}

export function WorkflowEditorOverviewTab({ draft, setDraft }: WorkflowEditorOverviewTabProps) {
  const nameError = validateWorkflowName(draft.name)
  const initialStepError = validateInitialStep(draft)

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Field label="Workflow name (kebab-case)" hint="Required before saving to the project.">
          <Input
            placeholder="my-workflow"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        {nameError ? (
          <p className="text-xs text-[var(--color-status-failed)]">{nameError}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Field label="Initial step" hint="Required before saving to the project.">
          <Select
            fullWidth
            value={draft.initialStep ?? ''}
            onChange={(e) => setDraft({ ...draft, initialStep: e.target.value || undefined })}
          >
            <option value="">(not set)</option>
            {draft.steps.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {initialStepError ? (
          <p className="text-xs text-[var(--color-status-failed)]">{initialStepError}</p>
        ) : null}
      </div>
      <Field label="Description" hint="Short user-facing summary (1–2 lines)">
        <Textarea
          rows={2}
          value={draft.description ?? ''}
          onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
        />
      </Field>
      <Field label="Max steps" hint="Loop cap (default 10)">
        <Input
          type="number"
          min={1}
          max={50}
          value={draft.maxSteps ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              maxSteps: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </Field>

      <div className="md:col-span-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Step summary
        </p>
        <p className="text-xs text-[var(--color-text)]">
          {draft.steps.length === 0
            ? '(no steps)'
            : draft.steps.map((s) => s.name || '?').join(' → ')}
        </p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          {draft.steps.length} steps · personas:{' '}
          {[...new Set(draft.steps.map((s) => s.persona).filter(Boolean))].join(', ') || '—'}
        </p>
      </div>
    </div>
  )
}
