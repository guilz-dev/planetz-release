import {
  type ExecutionOverrideOptionSources,
  type FacetKind,
  pruneStaleEffortBuckets,
  readEffortFromProviderOptions,
  type WorkflowSummary,
  writeEffortToProviderOptions,
} from '@planetz/shared'
import { AlertTriangle, Flag, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ExecutionProfileFields } from '../execution-profile-fields'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Tooltip } from '../ui/tooltip'
import { ConditionBuilder } from './workflow-condition-builder.js'
import { isReservedStepName } from './workflow-diagnostics.js'
import type { RuleDraft, StepDraft, WorkflowDraft } from './workflow-draft-types.js'
import {
  collectFacetKeyOptions,
  getStepFacetRef,
  getStepFacetRefReadOnly,
  setStepFacetRef,
} from './workflow-facet-utils.js'
import { workflowReturnTargets } from './workflow-return-targets.js'
import { collectRuleConditionSuggestions } from './workflow-rule-condition-suggestions.js'
import { StepFacetRefField } from './workflow-step-facet-ref-field.js'
import { WorkflowStepInstructionField } from './workflow-step-instruction-field.js'
import { WorkflowStepOutputContractsEditor } from './workflow-step-output-contracts-editor.js'
import { WorkflowStepWorkflowCallField } from './workflow-step-workflow-call-field.js'

const EMPTY_BUILTIN_CATALOG: Record<FacetKind, string[]> = {
  personas: [],
  policies: [],
  knowledge: [],
  instructions: [],
  reportFormats: [],
}

function stepProviderOptionsRaw(step: StepDraft): Record<string, unknown> | undefined {
  const value = step.raw.provider_options
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

interface StepCardProps {
  step: StepDraft
  index: number
  draft: WorkflowDraft
  stepNames: string[]
  workflows: WorkflowSummary[]
  errors: string[]
  warnings: string[]
  onChange: (next: StepDraft) => void
  onRename: (oldName: string, newName: string) => void
  profileSources: ExecutionOverrideOptionSources
  candidatesReloadKey?: number | string
  readOnly?: boolean
}

let _ruleId = 0
function newRule(): RuleDraft {
  _ruleId += 1
  return { id: `rule-new-${_ruleId}`, mode: 'tag', text: '', next: '' }
}

export function StepCard({
  step,
  index,
  draft,
  stepNames,
  workflows,
  errors,
  warnings,
  onChange,
  onRename,
  profileSources,
  candidatesReloadKey,
  readOnly = false,
}: StepCardProps) {
  const [nameDraft, setNameDraft] = useState(step.name)
  const [reservedNameError, setReservedNameError] = useState<string | null>(null)
  const [builtinCatalog, setBuiltinCatalog] =
    useState<Record<FacetKind, string[]>>(EMPTY_BUILTIN_CATALOG)

  useEffect(() => {
    setNameDraft(step.name)
    setReservedNameError(null)
  }, [step.name])

  useEffect(() => {
    let cancelled = false
    void window.orbit
      .listWorkflowBuiltinFacets()
      .then((catalog) => {
        if (cancelled) return
        setBuiltinCatalog(catalog)
      })
      .catch(() => {
        // keep empty catalog
      })
    return () => {
      cancelled = true
    }
  }, [])

  const personaOptions = useMemo(
    () => collectFacetKeyOptions(draft, 'personas', builtinCatalog.personas),
    [draft, builtinCatalog.personas],
  )
  const policyOptions = useMemo(
    () => collectFacetKeyOptions(draft, 'policies', builtinCatalog.policies),
    [draft, builtinCatalog.policies],
  )
  const knowledgeOptions = useMemo(
    () => collectFacetKeyOptions(draft, 'knowledge', builtinCatalog.knowledge),
    [draft, builtinCatalog.knowledge],
  )
  const instructionOptions = useMemo(
    () => collectFacetKeyOptions(draft, 'instructions', builtinCatalog.instructions),
    [draft, builtinCatalog.instructions],
  )
  const formatOptions = useMemo(
    () => collectFacetKeyOptions(draft, 'reportFormats', builtinCatalog.reportFormats),
    [draft, builtinCatalog.reportFormats],
  )

  const policyReadOnly = getStepFacetRefReadOnly(step, 'policies')
  const knowledgeReadOnly = getStepFacetRefReadOnly(step, 'knowledge')
  const returnTargets = workflowReturnTargets(draft)
  const hasError = errors.length > 0 || reservedNameError != null

  if (step.special) {
    const callTarget = typeof step.raw.call === 'string' ? step.raw.call : null
    const ruleCount = step.rules.length

    if (step.special === 'workflow_call' && !readOnly) {
      return (
        <div className="rounded-lg border border-[var(--color-status-pending)]/40 bg-[var(--color-status-pending-soft)]/20">
          <header className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-3 py-2">
            <Badge tone="exceeded">workflow_call</Badge>
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">
              {step.name}
            </span>
            {callTarget ? (
              <span className="text-[11px] text-[var(--color-muted-strong)]">
                calls <span className="font-mono">{callTarget}</span>
              </span>
            ) : null}
          </header>
          <WorkflowStepWorkflowCallField
            step={step}
            stepNames={stepNames}
            workflows={workflows}
            draft={draft}
            onChange={onChange}
          />
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-[var(--color-status-pending)]/40 bg-[var(--color-status-pending-soft)]/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="exceeded">{step.special}</Badge>
          <span className="text-sm font-semibold text-[var(--color-text-strong)]">{step.name}</span>
          {step.special === 'workflow_call' && callTarget ? (
            <span className="text-[11px] text-[var(--color-muted-strong)]">
              calls <span className="font-mono">{callTarget}</span>
              {ruleCount > 0 ? ` · ${ruleCount} rule${ruleCount === 1 ? '' : 's'}` : ''}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--color-muted)]">
              Advanced step — edit in YAML (⌘E).
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-[var(--color-surface)]/60 transition-shadow',
        hasError
          ? 'border-[var(--color-status-failed)]/60 shadow-[0_0_0_1px_var(--color-status-failed)]/30'
          : 'border-[var(--color-border)]',
      )}
    >
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-3 py-2">
        <Badge tone="neutral">#{index + 1}</Badge>

        <input
          aria-label="Step name"
          value={nameDraft}
          disabled={readOnly}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            const next = nameDraft.trim()
            if (next && isReservedStepName(next)) {
              setReservedNameError('COMPLETE and ABORT are reserved — cannot use as step names')
              setNameDraft(step.name)
              return
            }
            setReservedNameError(null)
            if (next && next !== step.name) onRename(step.name, next)
            else setNameDraft(step.name)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setNameDraft(step.name)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="focus-ring min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm font-semibold text-[var(--color-text-strong)]"
          placeholder="step-name"
        />
      </header>

      {hasError ? (
        <div className="flex items-start gap-2 border-b border-[var(--color-status-failed)]/30 bg-[var(--color-status-failed-soft)] px-3 py-1.5 text-xs text-[var(--color-status-failed)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            {reservedNameError ? <p>{reservedNameError}</p> : null}
            {errors.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: error list is wholesale-replaced
              <p key={i}>{e}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <ExecutionProfileFields
            providerId={`step-provider-${step.id}`}
            modelId={`step-model-${step.id}`}
            effortId={`step-effort-${step.id}`}
            providerLabel="Provider (override)"
            modelLabel="Model (override)"
            providerEmptyLabel="(inherit)"
            modelEmptyLabel="(inherit)"
            effortEmptyLabel="(inherit)"
            value={{
              provider: step.provider ?? '',
              model: step.model ?? '',
              effort:
                readEffortFromProviderOptions(step.provider, stepProviderOptionsRaw(step)) ?? '',
            }}
            sources={{
              ...profileSources,
              currentProvider: step.provider,
              currentModel: step.model,
            }}
            workflowName={draft.name}
            reloadKey={candidatesReloadKey}
            disabled={readOnly}
            onChange={({ provider, model, effort }) => {
              const prevProvider = step.provider ?? ''
              const existingOptions = stepProviderOptionsRaw(step)
              let providerOptions = existingOptions
              if (provider !== prevProvider) {
                providerOptions = pruneStaleEffortBuckets(provider, existingOptions)
              }
              const nextProviderOptions = writeEffortToProviderOptions(
                provider,
                effort,
                providerOptions,
              )
              const raw: Record<string, unknown> = {
                ...step.raw,
                provider: provider || undefined,
                model: model || undefined,
              }
              if (nextProviderOptions) {
                raw.provider_options = nextProviderOptions
              } else {
                delete raw.provider_options
              }
              onChange({
                ...step,
                provider: provider || undefined,
                model: model || undefined,
                raw,
              })
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Permission floor
          </span>
          <PermissionFloorToggle
            value={step.permission}
            disabled={readOnly}
            onChange={(next) => onChange({ ...step, permission: next })}
          />
        </div>

        <section className="flex flex-col gap-2 rounded-md border border-[var(--color-border)]/60 bg-[var(--color-panel)]/20 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Facets
          </h4>

          <div className="grid gap-2 md:grid-cols-3">
            <StepFacetRefField
              kind="personas"
              label="Persona"
              value={step.persona}
              options={personaOptions}
              disabled={readOnly}
              onChange={(key) => onChange(setStepFacetRef(step, 'personas', key))}
            />
            <StepFacetRefField
              kind="policies"
              label="Policy"
              value={getStepFacetRef(step, 'policies')}
              options={policyOptions}
              readOnly={policyReadOnly.readOnly}
              readOnlyReason={policyReadOnly.reason}
              disabled={readOnly}
              onChange={(key) => onChange(setStepFacetRef(step, 'policies', key))}
            />
            <StepFacetRefField
              kind="knowledge"
              label="Knowledge"
              value={getStepFacetRef(step, 'knowledge')}
              options={knowledgeOptions}
              readOnly={knowledgeReadOnly.readOnly}
              readOnlyReason={knowledgeReadOnly.reason}
              disabled={readOnly}
              onChange={(key) => onChange(setStepFacetRef(step, 'knowledge', key))}
            />
          </div>

          <WorkflowStepInstructionField
            step={step}
            draft={draft}
            instructionOptions={instructionOptions}
            disabled={readOnly}
            onChange={onChange}
          />
        </section>

        <WorkflowStepOutputContractsEditor
          step={step}
          formatOptions={formatOptions}
          disabled={readOnly}
          onChange={onChange}
        />

        <div className="flex flex-wrap gap-3 text-[12px]">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={step.edit ?? false}
              disabled={readOnly}
              onChange={(e) => onChange({ ...step, edit: e.target.checked })}
            />
            Can edit files
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={step.passPrevious ?? true}
              disabled={readOnly}
              onChange={(e) => onChange({ ...step, passPrevious: e.target.checked })}
            />
            Pass previous output
          </label>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Transitions ({step.rules.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              leading={<Plus size={12} />}
              disabled={readOnly}
              onClick={() => onChange({ ...step, rules: [...step.rules, newRule()] })}
            >
              Add rule
            </Button>
          </div>
          {step.rules.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
              No rules — fine if this step ends the workflow; add rules to continue
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {step.rules.map((r, ri) => (
                <ConditionBuilder
                  key={r.id}
                  rule={r}
                  stepNames={stepNames}
                  returnTargets={returnTargets}
                  tagSuggestions={collectRuleConditionSuggestions(draft, step, r.mode)}
                  allowAggregator={step.special === 'parallel'}
                  onChange={(nr) =>
                    onChange({
                      ...step,
                      rules: step.rules.map((x, i) => (i === ri ? nr : x)),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...step,
                      rules: step.rules.filter((_, i) => i !== ri),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {warnings.length > 0 ? (
          <ul className="rounded-md bg-[var(--color-status-exceeded-soft)] px-2.5 py-1.5 text-[11px] text-[var(--color-status-exceeded)]">
            {warnings.map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: warning list is wholesale-replaced
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

interface StepListItemProps {
  step: StepDraft
  index: number
  isInitial: boolean
  isSelected: boolean
  hasError: boolean
  hasWarning: boolean
  onSelect: () => void
  onMakeInitial: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  isDragging: boolean
  isDropTarget: boolean
  readOnly?: boolean
}

export function StepListItem({
  step,
  index,
  isInitial,
  isSelected,
  hasError,
  hasWarning,
  onSelect,
  onMakeInitial,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDropTarget,
  readOnly = false,
}: StepListItemProps) {
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', step.id)
        onDragStart()
      }}
      onDragOver={(e) => {
        if (readOnly) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver()
      }}
      onDrop={(e) => {
        if (readOnly) return
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={readOnly ? undefined : onDragEnd}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
        isSelected
          ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/40'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]/40 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]/40',
        hasError && !isSelected && 'border-[var(--color-status-failed)]/50',
        isDragging && 'opacity-40',
        isDropTarget && 'border-t-2 border-t-[var(--color-accent)]',
      )}
    >
      {readOnly ? (
        <span className="inline-flex opacity-40 text-[var(--color-muted)]">
          <GripVertical size={13} aria-hidden />
        </span>
      ) : (
        <Tooltip side="bottom" label="Drag to reorder">
          <span className="inline-flex cursor-grab text-[var(--color-muted)] active:cursor-grabbing">
            <GripVertical size={13} aria-hidden />
          </span>
        </Tooltip>
      )}

      <span className="w-5 shrink-0 text-center text-[10px] tabular-nums text-[var(--color-muted)]">
        {index + 1}
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate font-medium',
          step.name ? 'text-[var(--color-text-strong)]' : 'italic text-[var(--color-muted)]',
        )}
      >
        {step.name || '(unnamed)'}
      </span>

      {step.special ? <Badge tone="exceeded">{step.special}</Badge> : null}

      {hasError ? (
        <Tooltip side="bottom" label="This step has errors">
          <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--color-status-failed)]">
            <AlertTriangle size={11} />
          </span>
        </Tooltip>
      ) : hasWarning ? (
        <Tooltip side="bottom" label="This step has warnings">
          <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--color-status-exceeded)]">
            <AlertTriangle size={11} />
          </span>
        </Tooltip>
      ) : null}

      {!readOnly ? (
        <Tooltip
          side="bottom"
          label={isInitial ? 'Initial step — click to unset' : 'Set as initial step'}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMakeInitial()
            }}
            aria-label={isInitial ? 'Unset initial step' : 'Set as initial step'}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded transition-opacity',
              isInitial
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-muted)] opacity-0 hover:text-[var(--color-text)] group-hover:opacity-100',
            )}
          >
            <Flag size={11} fill={isInitial ? 'currentColor' : 'none'} />
          </button>
        </Tooltip>
      ) : null}

      {!readOnly ? (
        <Tooltip side="bottom" label="Delete step">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            aria-label="Remove step"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--color-muted)] opacity-0 transition-opacity hover:bg-[var(--color-status-failed-soft)] hover:text-[var(--color-status-failed)] group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}

const PERMISSION_FLOOR_OPTIONS: Array<{
  value: StepDraft['permission'] | undefined
  label: string
  hint: string
}> = [
  { value: undefined, label: 'Default', hint: 'Inherit workflow default' },
  { value: 'readonly', label: 'Read', hint: 'Read-only — cannot edit files' },
  { value: 'edit', label: 'Edit', hint: 'Edit files in workspace' },
  { value: 'full', label: 'Full', hint: 'Full access (incl. shell)' },
]

interface PermissionFloorToggleProps {
  value: StepDraft['permission'] | undefined
  disabled?: boolean
  onChange: (next: StepDraft['permission'] | undefined) => void
}

function PermissionFloorToggle({ value, disabled, onChange }: PermissionFloorToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Permission floor"
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)]',
        disabled && 'opacity-60',
      )}
    >
      {PERMISSION_FLOOR_OPTIONS.map((opt, i) => {
        const active = (value ?? undefined) === opt.value
        return (
          <Tooltip key={opt.label} side="bottom" label={opt.hint}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'focus-ring-inset px-2.5 py-1 text-[12px] transition-colors',
                i > 0 && 'border-l border-[var(--color-border-strong)]',
                active
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-strong)]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-panel)]/60 hover:text-[var(--color-text)]',
                disabled && 'cursor-not-allowed',
              )}
            >
              {opt.label}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
