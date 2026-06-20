import { Plus, Trash2 } from 'lucide-react'
import { OUTPUT_CONTRACT_REPORT_GROUP } from '../../../../shared/workflow-form/workflow-output-contracts.js'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'
import { Select } from '../ui/select'
import type { StepDraft } from './workflow-draft-types.js'
import type { FacetKeyOption, OutputContractRow } from './workflow-facet-utils.js'
import { parseOutputContracts, serializeOutputContracts } from './workflow-facet-utils.js'

interface WorkflowStepOutputContractsEditorProps {
  step: StepDraft
  formatOptions: FacetKeyOption[]
  disabled?: boolean
  onChange: (next: StepDraft) => void
}

function rowsFromStep(step: StepDraft): OutputContractRow[] {
  const parsed = parseOutputContracts(step.raw as Record<string, unknown>)
  return parsed.length > 0 ? parsed : []
}

export function WorkflowStepOutputContractsEditor({
  step,
  formatOptions,
  disabled = false,
  onChange,
}: WorkflowStepOutputContractsEditorProps) {
  const rows = rowsFromStep(step)

  function updateRows(nextRows: OutputContractRow[]) {
    const raw = { ...(step.raw as Record<string, unknown>) }
    const serialized = serializeOutputContracts(nextRows)
    if (serialized) {
      raw.output_contracts = serialized
    } else {
      delete raw.output_contracts
    }
    onChange({ ...step, raw })
  }

  return (
    <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/20">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Reports{rows.length > 0 ? ` (${rows.length})` : ''}
      </summary>
      <div className="flex flex-col gap-2 border-t border-[var(--color-border)] p-3">
        {rows.length === 0 ? (
          <p className="text-[11px] text-[var(--color-muted)]">No report outputs for this step.</p>
        ) : (
          rows.map((row, i) => (
            <div
              key={`${row.group}-${row.format}-${i}`}
              className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Field label="Group">
                <Input
                  value={row.group}
                  disabled={disabled}
                  placeholder={OUTPUT_CONTRACT_REPORT_GROUP}
                  onChange={(e) => {
                    const next = rows.map((r, ri) =>
                      ri === i ? { ...r, group: e.target.value } : r,
                    )
                    updateRows(next)
                  }}
                />
              </Field>
              <Field label="Format">
                <Select
                  fullWidth
                  value={row.format}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = rows.map((r, ri) =>
                      ri === i ? { ...r, format: e.target.value } : r,
                    )
                    updateRows(next)
                  }}
                >
                  <option value="">(select)</option>
                  {formatOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.key}
                    </option>
                  ))}
                  {row.format && !formatOptions.find((o) => o.key === row.format) ? (
                    <option value={row.format}>{row.format}</option>
                  ) : null}
                </Select>
              </Field>
              <Field label="Filename (optional)">
                <Input
                  value={row.name ?? ''}
                  disabled={disabled}
                  placeholder="00-plan.md"
                  onChange={(e) => {
                    const next = rows.map((r, ri) =>
                      ri === i ? { ...r, name: e.target.value || undefined } : r,
                    )
                    updateRows(next)
                  }}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  leading={<Trash2 size={12} />}
                  onClick={() => updateRows(rows.filter((_, ri) => ri !== i))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          leading={<Plus size={12} />}
          onClick={() =>
            updateRows([
              ...rows,
              {
                group: OUTPUT_CONTRACT_REPORT_GROUP,
                format: formatOptions[0]?.key ?? '',
              },
            ])
          }
        >
          Add report
        </Button>
      </div>
    </details>
  )
}
