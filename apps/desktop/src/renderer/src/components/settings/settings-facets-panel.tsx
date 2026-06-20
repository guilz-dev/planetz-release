import {
  applyPersonaRowModeSwitch,
  type FacetKind,
  findDuplicatePersonaKeys,
  orbitFacetsDirRelPath,
  type PersonaProviderEntry,
  type PersonaProviderRow,
  personaProvidersToRows,
  pruneStaleEffortBuckets,
  rowsToPersonaProviders,
  snapshotPersonaRowDraft,
  suggestFacetDuplicateKey,
} from '@planetz/shared'
import { Save } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useExecutionOptionSources } from '../../hooks/use-execution-option-sources.js'
import { ExecutionProfileFields } from '../execution-profile-fields.js'
import { Button } from '../ui/button.js'
import { Field, Input } from '../ui/input.js'
import { Toggle } from '../ui/toggle.js'
import { FacetEditorPane } from './facets/facet-editor-pane'
import { FacetNewEmptyPane } from './facets/facet-new-empty-pane'
import { FacetTreePane } from './facets/facet-tree-pane'
import { type FacetSelection, useFacetCatalog } from './facets/use-facet-catalog'

export type { FacetSelection }

interface SettingsFacetsPanelProps {
  initialSelection?: FacetSelection | null
  onOpenWorkflows?: (filterFacet?: FacetSelection) => void
}

function emptyPersonaRouteRow(personaKey: string): PersonaProviderRow {
  return {
    persona: personaKey,
    mode: 'structured',
    shorthand: '',
    provider: '',
    model: '',
    type: '',
    effort: '',
  }
}

function personaRouteRowForKey(
  personaKey: string,
  map: Record<string, PersonaProviderEntry> | undefined,
): PersonaProviderRow {
  const rows = personaProvidersToRows(map)
  const found = rows.find((row) => row.persona.trim() === personaKey)
  if (found) return found
  return emptyPersonaRouteRow(personaKey)
}

export function SettingsFacetsPanel({
  initialSelection = null,
  onOpenWorkflows,
}: SettingsFacetsPanelProps) {
  const catalog = useFacetCatalog()
  const appliedInitial = useRef<string | null>(null)
  const executionOptions = useExecutionOptionSources()
  const [personaRouteDraft, setPersonaRouteDraft] = useState<PersonaProviderRow | null>(null)
  const [personaRouteLoading, setPersonaRouteLoading] = useState(false)
  const [personaRouteSaving, setPersonaRouteSaving] = useState(false)
  const [personaRouteError, setPersonaRouteError] = useState<string | null>(null)
  const [personaRouteSavedAt, setPersonaRouteSavedAt] = useState(0)
  const [personaRouteEngineConfig, setPersonaRouteEngineConfig] =
    useState<ReturnType<typeof useExecutionOptionSources>['engineConfig']>(null)

  useEffect(() => {
    if (!initialSelection?.key || !catalog.catalogReady) return

    const token = `${initialSelection.kind}:${initialSelection.key}`
    const matchesSelection =
      catalog.selected?.kind === initialSelection.kind &&
      catalog.selected?.key === initialSelection.key

    if (appliedInitial.current === token) {
      if (!matchesSelection) {
        catalog.expandKind(initialSelection.kind)
        catalog.setSelected(initialSelection)
      }
      return
    }

    appliedInitial.current = token
    catalog.expandKind(initialSelection.kind)
    catalog.setSelected(initialSelection)
  }, [
    initialSelection,
    catalog.catalogReady,
    catalog.selected,
    catalog.setSelected,
    catalog.expandKind,
  ])

  const selected = catalog.selected
  const selectedItem = catalog.selectedItem
  const isDraft = selectedItem?.source === 'project' && !selected?.key
  const isNewDraft = Boolean(isDraft || (selected && !selectedItem))
  const activeSelection = selected
  const selectedPersonaKey = activeSelection?.kind === 'personas' ? activeSelection.key.trim() : ''
  const hasFacetEditor = Boolean(activeSelection && (selectedItem || isNewDraft))
  const canSaveFacet =
    hasFacetEditor &&
    catalog.selectedContent !== undefined &&
    Boolean(activeSelection?.key.trim()) &&
    (isNewDraft || catalog.selectedDirty)

  const personaRouteSources = useMemo(
    () => ({
      engineConfig: personaRouteEngineConfig ?? executionOptions.engineConfig,
      catalog: executionOptions.catalog,
    }),
    [personaRouteEngineConfig, executionOptions.engineConfig, executionOptions.catalog],
  )

  useEffect(() => {
    if (!selectedPersonaKey) {
      setPersonaRouteDraft(null)
      setPersonaRouteError(null)
      setPersonaRouteSavedAt(0)
      return
    }
    let cancelled = false
    setPersonaRouteLoading(true)
    setPersonaRouteError(null)
    setPersonaRouteSavedAt(0)
    void window.orbit
      .getEngineConfig()
      .then(({ config }) => {
        if (cancelled) return
        setPersonaRouteEngineConfig(config)
        setPersonaRouteDraft(personaRouteRowForKey(selectedPersonaKey, config.persona_providers))
      })
      .catch((err) => {
        if (cancelled) return
        setPersonaRouteDraft(emptyPersonaRouteRow(selectedPersonaKey))
        setPersonaRouteError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (cancelled) return
        setPersonaRouteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPersonaKey])

  function updatePersonaRouteDraft(patch: Partial<PersonaProviderRow>) {
    setPersonaRouteDraft((current) => {
      if (!current) return current
      let next = { ...current, ...patch }
      if (
        patch.provider !== undefined ||
        patch.model !== undefined ||
        patch.type !== undefined ||
        patch.effort !== undefined ||
        patch.providerOptions !== undefined
      ) {
        next = snapshotPersonaRowDraft(next)
      } else if (patch.shorthand !== undefined) {
        next = { ...next, shorthandDraft: patch.shorthand }
      }
      return next
    })
  }

  function isPersonaRouteDraftEmpty(row: PersonaProviderRow): boolean {
    return rowsToPersonaProviders([row]) === undefined
  }

  async function savePersonaRoute() {
    if (!selectedPersonaKey || !personaRouteDraft) return
    setPersonaRouteSaving(true)
    setPersonaRouteError(null)
    try {
      const { config: currentConfig } = await window.orbit.getEngineConfig()
      const existingRows = personaProvidersToRows(currentConfig.persona_providers).filter(
        (row) => row.persona.trim() !== selectedPersonaKey,
      )
      const normalizedDraft = { ...personaRouteDraft, persona: selectedPersonaKey }
      const nextRows = isPersonaRouteDraftEmpty(normalizedDraft)
        ? existingRows
        : [...existingRows, normalizedDraft]
      const duplicatePersonas = findDuplicatePersonaKeys(nextRows)
      if (duplicatePersonas.length > 0) {
        setPersonaRouteError(`Duplicate persona names: ${duplicatePersonas.join(', ')}`)
        return
      }
      const nextProviders = rowsToPersonaProviders(nextRows)
      const result = await window.orbit.updateEngineConfig({
        persona_providers: nextProviders ?? {},
      })
      setPersonaRouteEngineConfig(result.config)
      setPersonaRouteDraft(
        personaRouteRowForKey(selectedPersonaKey, result.config.persona_providers),
      )
      setPersonaRouteSavedAt(Date.now())
    } catch (err) {
      setPersonaRouteError(err instanceof Error ? err.message : String(err))
    } finally {
      setPersonaRouteSaving(false)
    }
  }

  async function handleSaveKeyAndContent(key: string, content: string): Promise<void> {
    if (!activeSelection) return
    const trimmed = key.trim()
    if (!trimmed) return
    await catalog.saveContent(activeSelection.kind, trimmed, content)
    catalog.setSelected({ kind: activeSelection.kind, key: trimmed })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-x-clip">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Facets</h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted-strong)]">
          Workspace-wide facet master under{' '}
          <span className="font-mono">{orbitFacetsDirRelPath()}/</span>. Workflows reference these
          keys — edit bodies here, not in the workflow editor.
        </p>
      </div>

      {catalog.error ? (
        <p className="text-xs text-[var(--color-status-failed)]">{catalog.error}</p>
      ) : null}

      <div className="flex min-w-0 gap-3">
        <FacetTreePane
          itemsByKind={catalog.itemsByKind}
          selected={catalog.selected}
          collapsed={catalog.collapsed}
          showBuiltin={catalog.showBuiltin}
          onToggleBuiltin={catalog.setShowBuiltin}
          onSelect={catalog.setSelected}
          onToggleCollapse={catalog.toggleCollapse}
          onAdd={catalog.addDraft}
        />

        <div className="min-w-0 flex-1">
          {selectedPersonaKey ? (
            <section className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
                    Runtime routing
                  </h3>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Route persona <span className="font-mono">{selectedPersonaKey}</span> to a
                    provider/model. Saved in{' '}
                    <span className="font-mono">engine-config.yaml:persona_providers</span>.
                  </p>
                </div>
                {personaRouteSavedAt > 0 ? (
                  <p className="text-[11px] text-[var(--color-status-done)]">Saved</p>
                ) : null}
              </div>
              {personaRouteError ? (
                <p className="mb-2 text-[11px] text-[var(--color-status-failed)]">
                  {personaRouteError}
                </p>
              ) : null}
              {personaRouteLoading || !personaRouteDraft ? (
                <p className="text-[11px] text-[var(--color-muted)]">Loading runtime routing…</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Toggle
                      checked={personaRouteDraft.mode === 'shorthand'}
                      disabled={personaRouteSaving}
                      aria-label="Use shorthand string instead of provider / model"
                      onCheckedChange={(checked) => {
                        const nextMode: PersonaProviderRow['mode'] = checked
                          ? 'shorthand'
                          : 'structured'
                        if (nextMode === personaRouteDraft.mode) return
                        setPersonaRouteDraft(applyPersonaRowModeSwitch(personaRouteDraft, nextMode))
                      }}
                    />
                    <span className="text-[12px] font-medium text-[var(--color-text)]">
                      Shorthand
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {personaRouteDraft.mode === 'shorthand'
                        ? 'Single string alias (e.g. openai).'
                        : 'Off — route by provider / model.'}
                    </span>
                  </div>
                  {personaRouteDraft.mode === 'shorthand' ? (
                    <Field label="Shorthand value">
                      <Input
                        value={personaRouteDraft.shorthand}
                        placeholder="e.g. openai"
                        disabled={personaRouteSaving}
                        onChange={(e) => updatePersonaRouteDraft({ shorthand: e.target.value })}
                      />
                    </Field>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ExecutionProfileFields
                        providerId={`facets-master-persona-route-provider-${selectedPersonaKey}`}
                        modelId={`facets-master-persona-route-model-${selectedPersonaKey}`}
                        effortId={`facets-master-persona-route-effort-${selectedPersonaKey}`}
                        providerLabel="Provider"
                        modelLabel="Model"
                        effortLabel="Effort"
                        providerEmptyLabel="(inherit)"
                        modelEmptyLabel="(inherit)"
                        effortEmptyLabel="(inherit)"
                        value={{
                          provider: personaRouteDraft.provider,
                          model: personaRouteDraft.model,
                          effort: personaRouteDraft.effort,
                        }}
                        sources={{
                          ...personaRouteSources,
                          currentProvider: personaRouteDraft.provider,
                          currentModel: personaRouteDraft.model,
                        }}
                        reloadKey={personaRouteSavedAt}
                        disabled={personaRouteSaving || executionOptions.loading}
                        onChange={({ provider, model, effort }) => {
                          const patch: Partial<PersonaProviderRow> = {
                            provider,
                            model,
                            effort: effort ?? '',
                          }
                          if (provider !== personaRouteDraft.provider) {
                            patch.providerOptions = pruneStaleEffortBuckets(
                              provider,
                              personaRouteDraft.providerOptions,
                            )
                          }
                          updatePersonaRouteDraft(patch)
                        }}
                      />
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      leading={<Save size={13} />}
                      loading={personaRouteSaving}
                      onClick={() => void savePersonaRoute()}
                    >
                      Save runtime routing
                    </Button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {activeSelection && (selectedItem || isNewDraft) ? (
            <FacetEditorPane
              item={{
                kind: activeSelection.kind,
                key: activeSelection.key,
                source: selectedItem?.source ?? 'project',
                content: catalog.selectedContent,
                stepReferences: selectedItem?.stepReferences,
                workflowReferences: selectedItem?.workflowReferences,
                keyEditable: selectedItem?.source === 'project' || isNewDraft,
                contentEditable: selectedItem?.source === 'project' || isNewDraft,
              }}
              mode="master"
              busy={catalog.busy}
              dirty={canSaveFacet}
              saving={catalog.busy}
              onSave={() => {
                if (!activeSelection || catalog.selectedContent === undefined) return
                void handleSaveKeyAndContent(activeSelection.key, catalog.selectedContent)
              }}
              onChange={(patch) => {
                if (patch.content !== undefined) catalog.setSelectedContent(patch.content)
                if (patch.key !== undefined) catalog.renameSelectedKey(patch.key)
              }}
              onRemove={() => {
                if (!activeSelection.key) return
                const wf = selectedItem?.workflowReferences ?? 0
                const steps = selectedItem?.stepReferences ?? 0
                let msg = `Delete ${activeSelection.kind} "${activeSelection.key}"?`
                if (wf > 0 || steps > 0) {
                  msg = `Delete ${activeSelection.kind} "${activeSelection.key}"?\n\nThis facet is used by ${wf} workflow(s) and ${steps} step(s). The master file will be removed; workflow YAML references will remain until you update them.`
                }
                if (!confirm(msg)) return
                void catalog.deleteFacet(activeSelection.kind, activeSelection.key)
              }}
              onOverride={() => {
                if (!activeSelection.key || selectedItem?.source !== 'builtin') return
                void catalog.overrideBuiltin(activeSelection.kind, activeSelection.key)
              }}
              onDuplicate={() => {
                if (!activeSelection?.key) return
                const existingKeys = new Set(
                  catalog.itemsByKind[activeSelection.kind].map((item) => item.key).filter(Boolean),
                )
                const copyKey = suggestFacetDuplicateKey(activeSelection.key, existingKeys)
                void catalog.saveContent(activeSelection.kind, copyKey, catalog.selectedContent)
              }}
            />
          ) : catalog.loading ? (
            <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-xs text-[var(--color-muted)]">
              Loading facets…
            </p>
          ) : (
            <FacetNewEmptyPane busy={catalog.busy} onCreate={(kind) => catalog.addDraft(kind)} />
          )}

          {catalog.refreshing ? (
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">Refreshing facet list…</p>
          ) : null}

          {selectedItem?.source === 'project' && activeSelection?.key ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="text-[11px] text-[var(--color-accent)] hover:underline"
                onClick={() =>
                  onOpenWorkflows?.({
                    kind: activeSelection.kind as FacetKind,
                    key: activeSelection.key,
                  })
                }
              >
                Open in Workflows
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
