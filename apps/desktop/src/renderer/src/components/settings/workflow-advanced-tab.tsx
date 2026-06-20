import { orbitWorkflowsDirRelPath } from '@planetz/shared'
import { useState } from 'react'
import { Field, Textarea } from '../ui/input'
import { advancedSectionToYaml, parseAdvancedSectionYaml } from './workflow-advanced-section.js'
import type { WorkflowDraft } from './workflow-draft-types.js'

interface WorkflowAdvancedTabProps {
  draft: WorkflowDraft
  setDraft: (next: WorkflowDraft) => void
  readOnly?: boolean
}

interface AdvancedSectionEditorProps {
  label: string
  hint: string
  value: unknown
  readOnly?: boolean
  onChange: (next: unknown | undefined) => void
}

function AdvancedSectionEditor({
  label,
  hint,
  value,
  readOnly,
  onChange,
}: AdvancedSectionEditorProps) {
  const [text, setText] = useState(() => advancedSectionToYaml(value))
  const [parseError, setParseError] = useState<string | null>(null)

  return (
    <Field label={label} hint={hint}>
      <Textarea
        value={text}
        readOnly={readOnly}
        rows={6}
        className="font-mono text-[11px]"
        placeholder="# empty — section omitted from saved YAML"
        onChange={(e) => {
          const nextText = e.target.value
          setText(nextText)
          try {
            onChange(parseAdvancedSectionYaml(nextText))
            setParseError(null)
          } catch (err) {
            setParseError(err instanceof Error ? err.message : String(err))
          }
        }}
      />
      {parseError ? (
        <p className="mt-1 text-[11px] text-[var(--color-status-failed)]">{parseError}</p>
      ) : null}
    </Field>
  )
}

export function WorkflowAdvancedTab({ draft, setDraft, readOnly }: WorkflowAdvancedTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-muted)]">
        Advanced workflow sections are stored in{' '}
        <span className="font-mono">{orbitWorkflowsDirRelPath()}/*.yaml</span>. Use YAML syntax;
        leave a section empty to omit it on save.
      </p>
      <AdvancedSectionEditor
        key={`${draft.name}-workflow_config`}
        label="workflow_config"
        hint="Runtime and provider options for the workflow."
        value={draft.workflowConfig}
        readOnly={readOnly}
        onChange={(workflowConfig) => setDraft({ ...draft, workflowConfig })}
      />
      <AdvancedSectionEditor
        key={`${draft.name}-loop_monitors`}
        label="loop_monitors"
        hint="Cycle monitors and thresholds."
        value={draft.loopMonitors}
        readOnly={readOnly}
        onChange={(loopMonitors) => setDraft({ ...draft, loopMonitors })}
      />
      <AdvancedSectionEditor
        key={`${draft.name}-rate_limit_fallback`}
        label="rate_limit_fallback"
        hint="Provider/model switch chain when rate limited."
        value={draft.rateLimitFallback}
        readOnly={readOnly}
        onChange={(rateLimitFallback) => setDraft({ ...draft, rateLimitFallback })}
      />
      <AdvancedSectionEditor
        key={`${draft.name}-subworkflow`}
        label="subworkflow"
        hint="Internal subworkflow definitions."
        value={draft.subworkflow}
        readOnly={readOnly}
        onChange={(subworkflow) => setDraft({ ...draft, subworkflow })}
      />
    </div>
  )
}
