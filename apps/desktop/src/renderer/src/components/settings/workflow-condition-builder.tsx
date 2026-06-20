import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import type { RuleDraft, RuleMode } from './workflow-draft-types.js'
import {
  patchRuleFields,
  patchRuleTransition,
  ruleReturnValue,
  ruleToCondition,
  ruleUsesReturn,
} from './workflow-rule-condition.js'
import { RULE_CONDITION_CUSTOM_OPTION } from './workflow-rule-condition-suggestions.js'

interface ConditionBuilderProps {
  rule: RuleDraft
  stepNames: string[]
  tagSuggestions: string[]
  /** Subworkflow return names for `rules[].return` (from `subworkflow.returns`). */
  returnTargets?: string[]
  allowAggregator: boolean
  onChange: (next: RuleDraft) => void
  onRemove: () => void
}

const MODE_LABEL: Record<RuleMode, string> = {
  tag: 'Tag match',
  ai: 'AI judge',
  all: 'all() — every match',
  any: 'any() — any match',
}

const MODE_HINT: Record<RuleMode, string> = {
  tag: 'Outcome label the agent reports (matched by rule order in this step)',
  ai: 'LLM judges whether the previous step output is true',
  all: 'All parallel substeps emitted the given tag',
  any: 'Any parallel substep emitted the given tag',
}

function previewTransition(rule: RuleDraft): string {
  const ret = ruleReturnValue(rule)
  if (ret) return `return: ${ret}`
  if (rule.next) return `next: ${rule.next}`
  return '(no transition)'
}

function TagConditionField({
  rule,
  suggestions,
  onChange,
}: {
  rule: RuleDraft
  suggestions: string[]
  onChange: (text: string) => void
}) {
  const inList = rule.text !== '' && suggestions.includes(rule.text)
  const [custom, setCustom] = useState(!inList && rule.text !== '')

  if (custom || (rule.text !== '' && !suggestions.includes(rule.text))) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          placeholder="Custom condition label"
          value={rule.text}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-[10px]"
          onClick={() => {
            setCustom(false)
            onChange('')
          }}
        >
          Pick from suggestions
        </Button>
      </div>
    )
  }

  return (
    <Select
      fullWidth
      value={rule.text}
      onChange={(e) => {
        const v = e.target.value
        if (v === RULE_CONDITION_CUSTOM_OPTION) {
          setCustom(true)
          onChange('')
          return
        }
        onChange(v)
      }}
    >
      <option value="">(select condition)</option>
      {suggestions.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
      <option value={RULE_CONDITION_CUSTOM_OPTION}>Other (custom)…</option>
    </Select>
  )
}

export function ConditionBuilder({
  rule,
  stepNames,
  tagSuggestions,
  returnTargets = [],
  allowAggregator,
  onChange,
  onRemove,
}: ConditionBuilderProps) {
  const availableModes: RuleMode[] = allowAggregator ? ['tag', 'ai', 'all', 'any'] : ['tag', 'ai']
  const useTagPicker = rule.mode === 'tag' || rule.mode === 'all' || rule.mode === 'any'
  const useReturn = ruleUsesReturn(rule)
  const returnValue = ruleReturnValue(rule) ?? ''
  const showReturnOption = useReturn || returnTargets.length > 0

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/40 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          condition
        </span>
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-border-strong)]">
          {availableModes.map((m) => {
            const active = rule.mode === m
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(patchRuleFields(rule, { mode: m }))}
                className={cn(
                  'px-2 py-1 text-[11px] transition-colors',
                  active
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
                )}
              >
                {MODE_LABEL[m]}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove rule"
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-status-failed-soft)] hover:text-[var(--color-status-failed)]"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <p className="mt-1 text-[10px] text-[var(--color-muted)]">{MODE_HINT[rule.mode]}</p>

      <div className="mt-2 grid gap-2">
        {useTagPicker ? (
          <TagConditionField
            rule={rule}
            suggestions={tagSuggestions}
            onChange={(text) => onChange(patchRuleFields(rule, { text }))}
          />
        ) : (
          <Input
            placeholder="Condition text for AI judge"
            value={rule.text}
            onChange={(e) => onChange(patchRuleFields(rule, { text: e.target.value }))}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {showReturnOption ? (
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-border-strong)]">
              <button
                type="button"
                aria-pressed={!useReturn}
                onClick={() => {
                  if (useReturn) {
                    onChange(
                      patchRuleTransition(rule, 'next', rule.next || stepNames[0] || 'COMPLETE'),
                    )
                  }
                }}
                className={cn(
                  'px-2 py-1 text-[11px] transition-colors',
                  !useReturn
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)]',
                )}
              >
                Next step
              </button>
              <button
                type="button"
                aria-pressed={useReturn}
                onClick={() => {
                  if (!useReturn) {
                    onChange(patchRuleTransition(rule, 'return', returnTargets[0] ?? returnValue))
                  }
                }}
                className={cn(
                  'px-2 py-1 text-[11px] transition-colors',
                  useReturn
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)]',
                )}
              >
                Return
              </button>
            </div>
          ) : null}

          {useReturn ? (
            returnTargets.length > 0 ? (
              <Select
                fullWidth
                value={returnValue}
                onChange={(e) => onChange(patchRuleTransition(rule, 'return', e.target.value))}
              >
                <option value="">(select return)</option>
                {returnTargets.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                placeholder="Return value (e.g. need_replan)"
                value={returnValue}
                onChange={(e) => onChange(patchRuleTransition(rule, 'return', e.target.value))}
              />
            )
          ) : (
            <Select
              fullWidth
              value={rule.next}
              onChange={(e) => onChange(patchRuleTransition(rule, 'next', e.target.value))}
            >
              <option value="">(select next)</option>
              {stepNames
                .filter((n) => n)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              <option value="COMPLETE">COMPLETE</option>
              <option value="ABORT">ABORT</option>
            </Select>
          )}
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[auto_1fr]">
        <span className="self-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          preview
        </span>
        <code className="rounded bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px] text-[var(--color-text)]">
          condition: {ruleToCondition(rule) || '(empty)'} · {previewTransition(rule)}
        </code>
      </div>

      <details className="mt-1.5">
        <summary className="cursor-pointer text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
          appendix (optional extra output)
        </summary>
        <Input
          className="mt-1"
          placeholder="Extra message when this rule matches"
          value={rule.appendix ?? ''}
          onChange={(e) =>
            onChange(patchRuleFields(rule, { appendix: e.target.value || undefined }))
          }
        />
      </details>
    </div>
  )
}
