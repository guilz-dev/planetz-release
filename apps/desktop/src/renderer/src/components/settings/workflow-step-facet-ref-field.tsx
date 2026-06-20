import type { FacetKind } from '@planetz/shared'
import { Field } from '../ui/input'
import { Select } from '../ui/select'
import { facetManagedPath } from './facets/facet-path'
import type { FacetKind as DraftFacetKind } from './workflow-draft-types.js'
import type { FacetKeyOption } from './workflow-facet-utils.js'

interface StepFacetRefFieldProps {
  kind: DraftFacetKind
  label: string
  value: string | undefined
  options: FacetKeyOption[]
  readOnly?: boolean
  readOnlyReason?: string
  disabled?: boolean
  onChange: (key: string | undefined) => void
}

export function StepFacetRefField({
  kind,
  label,
  value,
  options,
  readOnly = false,
  readOnlyReason,
  disabled = false,
  onChange,
}: StepFacetRefFieldProps) {
  const selected = options.find((o) => o.key === value)
  const path = selected?.path ?? (value ? facetManagedPath(kind as FacetKind, value) : undefined)

  return (
    <Field label={label} hint={readOnly && readOnlyReason ? readOnlyReason : undefined}>
      <Select
        fullWidth
        value={value ?? ''}
        disabled={disabled || readOnly}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">(not set)</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key}
            {!o.inWorkflowMap ? ' (builtin)' : ''}
          </option>
        ))}
        {value && !options.find((o) => o.key === value) ? (
          <option value={value}>{value} (current)</option>
        ) : null}
      </Select>
      {path ? (
        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-muted)]" title={path}>
          {path}
        </p>
      ) : null}
    </Field>
  )
}
