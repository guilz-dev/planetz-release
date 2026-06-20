import { useEffect, useState } from 'react'
import { Textarea } from '../ui/input'
import { Select } from '../ui/select'
import { facetManagedPath } from './facets/facet-path'
import type { StepDraft, WorkflowDraft } from './workflow-draft-types.js'
import type { FacetKeyOption } from './workflow-facet-utils.js'
import { getStepInstructionReadOnly, isInstructionFacetKey } from './workflow-facet-utils.js'

type InstructionMode = 'facet' | 'inline'

interface WorkflowStepInstructionFieldProps {
  step: StepDraft
  draft: WorkflowDraft
  instructionOptions: FacetKeyOption[]
  disabled?: boolean
  onChange: (next: StepDraft) => void
}

function initialMode(step: StepDraft, instructionKeys: string[]): InstructionMode {
  if (isInstructionFacetKey(step.instruction, instructionKeys)) return 'facet'
  return 'inline'
}

export function WorkflowStepInstructionField({
  step,
  draft,
  instructionOptions,
  disabled = false,
  onChange,
}: WorkflowStepInstructionFieldProps) {
  const instructionKeys = draft.instructions.map((m) => m.key).filter(Boolean)
  const instructionGuard = getStepInstructionReadOnly(step)
  const fieldDisabled = disabled || instructionGuard.readOnly
  const [mode, setMode] = useState<InstructionMode>(() => initialMode(step, instructionKeys))

  useEffect(() => {
    setMode(initialMode(step, instructionKeys))
  }, [step.id, step, instructionKeys])

  const selected = instructionOptions.find((o) => o.key === step.instruction)
  const path =
    mode === 'facet'
      ? (selected?.path ??
        (step.instruction ? facetManagedPath('instructions', step.instruction) : undefined))
      : undefined

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Instruction
        </span>
        {instructionGuard.readOnly ? (
          <p className="text-[10px] text-[var(--color-muted)]">{instructionGuard.reason}</p>
        ) : (
          <div className="flex gap-3 text-[12px] text-[var(--color-muted)]">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`instruction-mode-${step.id}`}
                checked={mode === 'facet'}
                disabled={fieldDisabled}
                onChange={() => {
                  setMode('facet')
                  if (isInstructionFacetKey(step.instruction, instructionKeys)) return
                  const first = instructionOptions[0]?.key
                  if (first) onChange({ ...step, instruction: first })
                }}
              />
              Facet key
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`instruction-mode-${step.id}`}
                checked={mode === 'inline'}
                disabled={fieldDisabled}
                onChange={() => {
                  setMode('inline')
                  if (isInstructionFacetKey(step.instruction, instructionKeys)) {
                    onChange({ ...step, instruction: undefined })
                  }
                }}
              />
              Inline text
            </label>
          </div>
        )}
      </div>
      {instructionGuard.readOnly ? (
        <code className="rounded bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px] text-[var(--color-text)]">
          {JSON.stringify((step.raw as Record<string, unknown>).instruction)}
        </code>
      ) : mode === 'facet' ? (
        <>
          <Select
            fullWidth
            aria-label="Instruction facet"
            value={step.instruction ?? ''}
            disabled={fieldDisabled}
            onChange={(e) => onChange({ ...step, instruction: e.target.value || undefined })}
          >
            <option value="">(not set)</option>
            {instructionOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key}
                {!o.inWorkflowMap ? ' (builtin)' : ''}
              </option>
            ))}
            {step.instruction && !selected ? (
              <option value={step.instruction}>{step.instruction} (current)</option>
            ) : null}
          </Select>
          {path ? (
            <p
              className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-muted)]"
              title={path}
            >
              {path}
            </p>
          ) : null}
        </>
      ) : (
        <Textarea
          aria-label="Instruction (inline)"
          rows={4}
          value={step.instruction ?? ''}
          disabled={fieldDisabled}
          onChange={(e) => onChange({ ...step, instruction: e.target.value || undefined })}
          placeholder="Describe what this step does…"
        />
      )}
    </div>
  )
}
