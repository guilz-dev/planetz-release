import { type WorkflowSummary, workflowSummaryLabel } from '@planetz/shared'
import { Select } from './ui/select'
import { WorkflowCombobox } from './workflow-combobox'

interface WorkflowSelectorProps {
  workflows: WorkflowSummary[]
  value: string
  onChange: (name: string) => void
  disabled?: boolean
  /** Opens Settings → Workflows (inline combobox footer only). */
  onNewWorkflow?: () => void
  /** Category order for grouping builtin workflows in the inline combobox. */
  builtinWorkflowCategoryOrder?: string[]
  /** Recently used workflow names (newest first) for the inline combobox Recent group. */
  recentWorkflowNames?: string[]
  /** When true, searchable combobox for PromptComposer (§12.1 v0.2). */
  inline?: boolean
}

/**
 * @deprecated Use {@link WorkflowSelectionBar} for Prompt Composer and Issue Tab workflow
 * selection. This wrapper remains for legacy docs and tests only.
 */
export function WorkflowSelector({
  workflows,
  value,
  onChange,
  disabled,
  onNewWorkflow,
  builtinWorkflowCategoryOrder,
  recentWorkflowNames,
  inline,
}: WorkflowSelectorProps) {
  if (inline) {
    return (
      <WorkflowCombobox
        workflows={workflows}
        value={value}
        onChange={onChange}
        onNewWorkflow={onNewWorkflow}
        builtinWorkflowCategoryOrder={builtinWorkflowCategoryOrder}
        recentWorkflowNames={recentWorkflowNames}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        Workflow
      </span>
      <Select
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {workflows.map((wf) => (
          <option key={wf.name} value={wf.name}>
            {workflowSummaryLabel(wf)}
          </option>
        ))}
      </Select>
    </div>
  )
}
