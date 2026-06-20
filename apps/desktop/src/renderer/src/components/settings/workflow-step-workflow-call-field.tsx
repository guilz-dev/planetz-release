import type { WorkflowSummary } from '@planetz/shared'
import { Plus } from 'lucide-react'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { Field } from '../ui/input.js'
import { WorkflowCallTargetPicker } from './workflow-call-target-picker.js'
import { ConditionBuilder } from './workflow-condition-builder.js'
import type { RuleDraft, StepDraft, WorkflowDraft } from './workflow-draft-types.js'
import { workflowReturnTargets } from './workflow-return-targets.js'
import { serializeRuleEntry } from './workflow-rule-condition.js'
import { collectRuleConditionSuggestions } from './workflow-rule-condition-suggestions.js'

interface WorkflowStepWorkflowCallFieldProps {
  step: StepDraft
  stepNames: string[]
  workflows: WorkflowSummary[]
  draft: WorkflowDraft
  disabled?: boolean
  onChange: (next: StepDraft) => void
}

let _ruleId = 0
function newRule(): RuleDraft {
  _ruleId += 1
  return { id: `rule-wfc-${_ruleId}`, mode: 'tag', text: '', next: '' }
}

function patchWorkflowCallStep(
  step: StepDraft,
  patch: { call?: string; rules?: RuleDraft[] },
): StepDraft {
  const rules = patch.rules ?? step.rules
  const call = patch.call ?? (typeof step.raw.call === 'string' ? step.raw.call : '')
  const rawRules = rules.map((r) => serializeRuleEntry(r))
  return {
    ...step,
    rules,
    raw: {
      ...step.raw,
      name: step.name,
      kind: 'workflow_call',
      call,
      rules: rawRules,
    },
  }
}

export function WorkflowStepWorkflowCallField({
  step,
  stepNames,
  workflows,
  draft,
  disabled = false,
  onChange,
}: WorkflowStepWorkflowCallFieldProps) {
  const { t } = useI18n()
  const callValue = typeof step.raw.call === 'string' ? step.raw.call : ''
  const returnTargets = workflowReturnTargets(draft)
  const tagSuggestions = collectRuleConditionSuggestions(draft, step, 'tag')

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <Field
        label={t('settings.workflowCall.fieldLabel')}
        hint={t('settings.workflowCall.fieldHint')}
      >
        <WorkflowCallTargetPicker
          workflows={workflows}
          value={callValue}
          disabled={disabled}
          onChange={(name) => onChange(patchWorkflowCallStep(step, { call: name }))}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Routing rules
          </span>
          {!disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leading={<Plus size={12} />}
              onClick={() =>
                onChange(patchWorkflowCallStep(step, { rules: [...step.rules, newRule()] }))
              }
            >
              Add rule
            </Button>
          ) : null}
        </div>
        {step.rules.length === 0 ? (
          <p className="text-xs italic text-[var(--color-muted)]">
            No rules — add at least one transition.
          </p>
        ) : (
          step.rules.map((rule) => (
            <ConditionBuilder
              key={rule.id}
              rule={rule}
              stepNames={stepNames}
              returnTargets={returnTargets}
              tagSuggestions={tagSuggestions}
              allowAggregator={false}
              onChange={(next) =>
                onChange(
                  patchWorkflowCallStep(step, {
                    rules: step.rules.map((r) => (r.id === rule.id ? next : r)),
                  }),
                )
              }
              onRemove={() =>
                onChange(
                  patchWorkflowCallStep(step, {
                    rules: step.rules.filter((r) => r.id !== rule.id),
                  }),
                )
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
