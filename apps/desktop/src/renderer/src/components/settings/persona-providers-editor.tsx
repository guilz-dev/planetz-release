import {
  applyPersonaRowModeSwitch,
  type ExecutionOverrideOptionSources,
  type PersonaProviderRow,
  pruneStaleEffortBuckets,
  snapshotPersonaRowDraft,
} from '@planetz/shared'
import { ExecutionProfileFields } from '../execution-profile-fields'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'
import { Select } from '../ui/select'

interface PersonaProvidersEditorProps {
  rows: PersonaProviderRow[]
  duplicateKeys: string[]
  onRowsChange: (next: PersonaProviderRow[]) => void
  profileSources: ExecutionOverrideOptionSources
  disabled?: boolean
  reloadKey?: number | string
}

const EMPTY_ROW: PersonaProviderRow = {
  persona: '',
  mode: 'structured',
  shorthand: '',
  provider: '',
  model: '',
  type: '',
  effort: '',
}

export function PersonaProvidersEditor({
  rows,
  duplicateKeys,
  onRowsChange,
  profileSources,
  disabled = false,
  reloadKey,
}: PersonaProvidersEditorProps) {
  function updateRow(index: number, patch: Partial<PersonaProviderRow>) {
    const next = [...rows]
    let row = { ...rows[index]!, ...patch }
    if (
      patch.provider !== undefined ||
      patch.model !== undefined ||
      patch.type !== undefined ||
      patch.effort !== undefined ||
      patch.providerOptions !== undefined
    ) {
      row = snapshotPersonaRowDraft(row)
    } else if (patch.shorthand !== undefined) {
      row = { ...row, shorthandDraft: patch.shorthand }
    }
    next[index] = row
    onRowsChange(next)
  }

  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        persona_providers
      </h3>
      <p className="mb-2 text-[11px] text-[var(--color-muted)]">
        Route each workflow persona to a provider/model (or a shorthand provider alias).
      </p>
      {duplicateKeys.length > 0 ? (
        <p className="mb-2 text-[11px] text-[var(--color-status-failed)]">
          Duplicate persona names: {duplicateKeys.join(', ')}. Resolve before saving.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const personaKey = row.persona.trim()
          const isDuplicate = personaKey.length > 0 && duplicateKeys.includes(personaKey)
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited by index
              key={index}
              className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2"
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[8rem] flex-1">
                  <Field label="Persona">
                    <Input
                      value={row.persona}
                      placeholder="e.g. coder"
                      aria-invalid={isDuplicate}
                      onChange={(e) => updateRow(index, { persona: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="min-w-[9rem]">
                  <Field label="Entry type">
                    <Select
                      fullWidth
                      value={row.mode}
                      onChange={(e) => {
                        const nextMode = e.target.value as PersonaProviderRow['mode']
                        if (nextMode === row.mode) return
                        onRowsChange(
                          rows.map((r, i) =>
                            i === index ? applyPersonaRowModeSwitch(row, nextMode) : r,
                          ),
                        )
                      }}
                    >
                      <option value="structured">provider / model</option>
                      <option value="shorthand">shorthand string</option>
                    </Select>
                  </Field>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              {row.mode === 'shorthand' ? (
                <Field label="Shorthand value" hint="Single string alias (takt config shorthand).">
                  <Input
                    value={row.shorthand}
                    placeholder="e.g. openai"
                    onChange={(e) => updateRow(index, { shorthand: e.target.value })}
                  />
                </Field>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <ExecutionProfileFields
                      providerId={`persona-provider-${index}`}
                      modelId={`persona-model-${index}`}
                      effortId={`persona-effort-${index}`}
                      providerEmptyLabel="(inherit)"
                      modelEmptyLabel="(inherit)"
                      effortEmptyLabel="(inherit)"
                      value={{
                        provider: row.provider,
                        model: row.model,
                        effort: row.effort,
                      }}
                      sources={{
                        ...profileSources,
                        currentProvider: row.provider,
                        currentModel: row.model,
                      }}
                      reloadKey={reloadKey}
                      disabled={disabled}
                      onChange={({ provider, model, effort }) => {
                        const patch: Partial<PersonaProviderRow> = {
                          provider,
                          model,
                          effort: effort ?? '',
                        }
                        if (provider !== row.provider) {
                          patch.providerOptions = pruneStaleEffortBuckets(
                            provider,
                            row.providerOptions,
                          )
                        }
                        updateRow(index, patch)
                      }}
                    />
                  </div>
                  <div className="min-w-[6rem] flex-1">
                    <Field label="Type" hint="Optional; omit when unused.">
                      <Input
                        value={row.type}
                        onChange={(e) => updateRow(index, { type: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        className="mt-2"
        onClick={() => onRowsChange([...rows, { ...EMPTY_ROW }])}
      >
        Add persona route
      </Button>
    </section>
  )
}
