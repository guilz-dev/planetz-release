import type {
  FacetKind,
  WorkflowDiagnostic,
  WorkflowFormMode,
  WorkflowSummary,
} from '@planetz/shared'
import { ORBIT_DISPLAY_NAME, planetzWorkflowRelPath } from '@planetz/shared'
import {
  AlertCircle,
  ArrowLeft,
  CircleDot,
  Code2,
  Download,
  FileDiff,
  ListChecks,
  Plus,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ConfirmDialogRequest } from '../../hooks/use-confirm-dialog.js'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { StatusDot } from '../ui/status-dot'
import { Tabs } from '../ui/tabs'
import { Tooltip } from '../ui/tooltip'
import type { WorkflowEditorTab } from './use-workflow-editor-actions'
import { WorkflowAdvancedTab } from './workflow-advanced-tab'
import type { findDanglingRefs, routeDiagnosticsToSteps } from './workflow-diagnostics.js'
import { WorkflowDiffDialog } from './workflow-diff-dialog'
import { WorkflowDoctorPanel } from './workflow-doctor-panel'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { WorkflowEditorOverviewTab } from './workflow-editor-overview-tab'
import { FacetsTab } from './workflow-facets-tab'
import { ruleUsesReturn } from './workflow-rule-condition.js'
import { StepCard, StepListItem } from './workflow-step-card'
import { WorkflowStepGraph } from './workflow-step-graph'
import { WorkflowYamlDrawer } from './workflow-yaml-drawer'

export type RoutedWorkflowDiagnostics = ReturnType<typeof routeDiagnosticsToSteps>

type StepsView = 'list' | 'graph'

export interface WorkflowEditorWorkspaceViewProps {
  draft: WorkflowDraft
  setDraft: Dispatch<SetStateAction<WorkflowDraft | null>>
  summary: WorkflowSummary | undefined
  dirty: boolean
  saving: boolean
  saveError: string | null
  currentYaml: string
  originalYaml: string
  canSaveProject: boolean
  diagnostics: WorkflowDiagnostic[] | null
  routedDiagnostics: RoutedWorkflowDiagnostics | null
  hasDoctorError: boolean
  validating: boolean
  runValidate: () => void
  yamlOnlyMode: boolean
  formMode: WorkflowFormMode
  readonlyReason: string | null
  partialBanner: string | null
  formSafe: boolean
  workflows: WorkflowSummary[]
  danglingRefs: ReturnType<typeof findDanglingRefs>
  tab: WorkflowEditorTab
  setTab: (tab: WorkflowEditorTab) => void
  stepsView: StepsView
  setStepsView: Dispatch<SetStateAction<StepsView>>
  yamlDrawerOpen: boolean
  setYamlDrawerOpen: (open: boolean) => void
  yamlDrawerText: string
  setYamlDrawerText: (text: string) => void
  saveDiffOpen: boolean
  setSaveDiffOpen: (open: boolean) => void
  builtinDiff: { name: string; yaml: string } | null
  setBuiltinDiff: Dispatch<SetStateAction<{ name: string; yaml: string } | null>>
  selectedStepId: string | null
  setSelectedStepId: Dispatch<SetStateAction<string | null>>
  handleBack: () => void
  handleReimportFromTakt: () => Promise<void>
  handleDiscardDraft: () => Promise<void>
  handleSave: (yamlToWrite?: string) => Promise<void>
  applyYamlDrawer: () => Promise<void>
  draggingStepId: string | null
  dropTargetId: string | null
  updateStepAt: (index: number, next: WorkflowDraft['steps'][number]) => void
  renameStep: (oldName: string, newName: string) => Promise<void>
  addStep: () => void
  beginStepDrag: (id: string) => void
  hoverStepDropTarget: (id: string) => void
  clearStepDragState: () => void
  clearDropTarget: () => void
  commitStepReorderFromDrag: () => void
  removeStep: (index: number) => Promise<void>
  requestConfirm: (payload: ConfirmDialogRequest | string) => Promise<boolean>
  stepProfileSources: Parameters<typeof StepCard>[0]['profileSources']
  onEditInFacets?: (selection: { kind: FacetKind; key: string }) => void
}

export function WorkflowEditorWorkspaceView(props: WorkflowEditorWorkspaceViewProps) {
  const {
    draft,
    setDraft,
    summary,
    dirty,
    saving,
    saveError,
    currentYaml,
    originalYaml,
    canSaveProject,
    diagnostics,
    routedDiagnostics,
    hasDoctorError,
    validating,
    runValidate,
    yamlOnlyMode,
    formMode,
    readonlyReason,
    partialBanner,
    formSafe,
    workflows,
    danglingRefs,
    tab,
    setTab,
    stepsView,
    setStepsView,
    yamlDrawerOpen,
    setYamlDrawerOpen,
    yamlDrawerText,
    setYamlDrawerText,
    saveDiffOpen,
    setSaveDiffOpen,
    builtinDiff,
    setBuiltinDiff,
    selectedStepId,
    setSelectedStepId,
    handleBack,
    handleReimportFromTakt,
    handleDiscardDraft,
    handleSave,
    applyYamlDrawer,
    draggingStepId,
    dropTargetId,
    updateStepAt,
    renameStep,
    addStep,
    beginStepDrag,
    hoverStepDropTarget,
    clearStepDragState,
    clearDropTarget,
    commitStepReorderFromDrag,
    removeStep,
    requestConfirm,
    stepProfileSources,
    onEditInFacets,
  } = props

  const stepNames = draft.steps.map((s) => s.name).filter(Boolean)
  const selectedIndex = draft.steps.findIndex((s) => s.id === selectedStepId)
  const selectedStep = selectedIndex >= 0 ? draft.steps[selectedIndex] : null

  function handleNavigateToSteps(payload: { kind: FacetKind; key: string; stepNames: string[] }) {
    setTab('steps')
    setStepsView('list')
    const firstName = payload.stepNames[0]
    if (!firstName) return
    const match = draft.steps.find((s) => s.name === firstName)
    if (match) setSelectedStepId(match.id)
  }

  const statusState: 'green' | 'yellow' | 'red' = hasDoctorError
    ? 'red'
    : formMode === 'yaml-only'
      ? 'yellow'
      : formMode === 'partial'
        ? 'yellow'
        : 'green'

  const errorCount = (diagnostics ?? []).filter((d) => d.level === 'error').length
  const compactStatusLabel =
    statusState === 'green'
      ? 'Editable'
      : statusState === 'yellow' && formMode === 'partial'
        ? 'Partial'
        : statusState === 'yellow'
          ? 'YAML-only'
          : `Error${errorCount > 0 ? ` (${errorCount})` : ''}`

  const statusTooltipLabel = validating
    ? 'Running orbit doctor validation…'
    : formMode === 'full'
      ? 'This workflow structure is supported by the form editor. Edit Overview, Steps, and Facets, then Save to project writes the project workflow YAML. orbit doctor reports no blocking errors.'
      : formMode === 'partial'
        ? 'workflow_call steps are editable on the Steps tab (call target and routing rules). parallel, arpeggio, and team_leader steps use the YAML drawer (⌘E). Overview, normal steps, and Facets stay editable; Save to project is allowed when doctor passes.'
        : formMode === 'yaml-only'
          ? (readonlyReason ??
            'This workflow is not supported by the form editor (unsupported keys, advanced steps, or round-trip loss). Use the YAML drawer; form fields stay read-only.')
          : errorCount > 0
            ? `orbit doctor found ${errorCount} blocking error${errorCount === 1 ? '' : 's'}. Fix them before Save to project, or edit raw YAML.`
            : 'Resolve validation errors before saving from the form.'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leading={<ArrowLeft size={13} />}
          type="button"
          onClick={handleBack}
        >
          Catalog
        </Button>
        {draft.name.trim() ? (
          <Button
            variant="ghost"
            size="sm"
            leading={<Download size={13} />}
            type="button"
            disabled={saving}
            onClick={() => void handleReimportFromTakt()}
          >
            Re-import from isolated .takt
          </Button>
        ) : null}
        <span className="text-sm font-semibold text-[var(--color-text-strong)]">
          {draft.name.trim() || 'New workflow'}
        </span>
        {summary ? <Badge tone="completed">{summary.source}</Badge> : null}

        <Tooltip side="bottom" wide label={statusTooltipLabel}>
          <span
            className={cn(
              'inline-flex cursor-default items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
              statusState === 'green' &&
                'border-[var(--color-status-completed)]/30 bg-[var(--color-status-completed-soft)]/40 text-[var(--color-status-completed)]',
              statusState === 'yellow' &&
                'border-[var(--color-status-exceeded)]/30 bg-[var(--color-status-exceeded-soft)]/40 text-[var(--color-status-exceeded)]',
              statusState === 'red' &&
                'border-[var(--color-status-failed)]/30 bg-[var(--color-status-failed-soft)]/40 text-[var(--color-status-failed)]',
            )}
          >
            <StatusDot
              tone={
                statusState === 'green'
                  ? 'completed'
                  : statusState === 'yellow'
                    ? 'exceeded'
                    : 'failed'
              }
              className="h-1.5 w-1.5"
            />
            {validating ? 'Validating…' : compactStatusLabel}
          </span>
        </Tooltip>

        {danglingRefs.length > 0 ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-[var(--color-status-failed)]"
            title={`${danglingRefs.length} dangling rule reference${danglingRefs.length === 1 ? '' : 's'}`}
          >
            <AlertCircle size={11} /> {danglingRefs.length}
          </span>
        ) : null}

        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-strong)]">
          {dirty ? (
            <>
              <CircleDot size={9} fill="currentColor" /> Unsaved
            </>
          ) : null}
        </span>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          leading={<Code2 size={13} />}
          onClick={() => {
            setYamlDrawerText(currentYaml)
            setYamlDrawerOpen(true)
          }}
        >
          YAML{' '}
          <span className="ml-1 rounded bg-[var(--color-panel-strong)] px-1 text-[10px]">⌘E</span>
        </Button>
      </div>

      {readonlyReason ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-status-exceeded)]/30 bg-[var(--color-status-exceeded-soft)] px-3 py-2 text-xs text-[var(--color-status-exceeded)]">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">YAML-only mode</p>
            <p className="opacity-90">{readonlyReason}</p>
            <p className="mt-0.5 opacity-75">
              Overview and Advanced stay read-only. Browse Steps and Facets here; edit in the YAML
              drawer (⌘E).
            </p>
          </div>
        </div>
      ) : null}

      {partialBanner ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-status-pending)]/30 bg-[var(--color-status-pending-soft)]/30 px-3 py-2 text-xs text-[var(--color-status-pending)]">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <p className="opacity-90">{partialBanner}</p>
        </div>
      ) : null}

      <Tabs<WorkflowEditorTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview', leading: <Sparkles size={12} /> },
          {
            value: 'steps',
            label: `Steps (${draft.steps.length})`,
            leading: <ListChecks size={12} />,
          },
          { value: 'facets', label: 'Facets', leading: <FileDiff size={12} /> },
          { value: 'advanced', label: 'Advanced', leading: <Settings2 size={12} /> },
        ]}
      />

      {tab === 'overview' ? (
        <fieldset
          disabled={!formSafe}
          className={cn('flex flex-col gap-3', !formSafe && 'opacity-60')}
        >
          <WorkflowEditorOverviewTab draft={draft} setDraft={setDraft} />
        </fieldset>
      ) : null}

      {tab === 'steps'
        ? (() => {
            const stepsReadOnly = yamlOnlyMode
            const stepDiagnostics = draft.steps.map((s) => {
              const errs: string[] = []
              const warns: string[] = []
              if (!s.name) errs.push('Step name is empty')
              if (!s.persona && !s.special) warns.push('persona is not set')
              for (const r of s.rules) {
                if (!r.next && !ruleUsesReturn(r)) {
                  errs.push(`rule "${r.text || '(empty)'}" has no next step or return`)
                }
              }
              const stepDoctor = routedDiagnostics?.byStep.get(s.name) ?? []
              for (const dx of stepDoctor) {
                if (dx.level === 'error') errs.push(dx.message)
                else warns.push(dx.message)
              }
              return { errs, warns }
            })
            const selectedDiag = selectedIndex >= 0 ? stepDiagnostics[selectedIndex] : null

            return (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    leading={<Plus size={12} />}
                    onClick={addStep}
                    disabled={stepsReadOnly}
                  >
                    Add step
                  </Button>
                  <span className="text-[11px] text-[var(--color-muted)]">View:</span>
                  <Button
                    variant={stepsView === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    type="button"
                    onClick={() => setStepsView('list')}
                  >
                    List
                  </Button>
                  <Button
                    variant={stepsView === 'graph' ? 'secondary' : 'ghost'}
                    size="sm"
                    type="button"
                    onClick={() => setStepsView('graph')}
                  >
                    Graph
                  </Button>
                </div>

                {stepsView === 'graph' ? <WorkflowStepGraph draft={draft} /> : null}

                {stepsView === 'list' && draft.steps.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
                    No steps yet. Use &quot;Add step&quot; to create one.
                  </p>
                ) : null}

                {stepsView === 'list' && draft.steps.length > 0 ? (
                  <div className="flex gap-3">
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop step list container */}
                    <div
                      className="flex w-56 shrink-0 flex-col gap-1"
                      onDragLeave={(e) => {
                        const next = e.relatedTarget
                        if (next instanceof Node && e.currentTarget.contains(next)) return
                        clearDropTarget()
                      }}
                    >
                      {draft.steps.map((s, i) => {
                        const { errs, warns } = stepDiagnostics[i]
                        return (
                          <StepListItem
                            key={s.id}
                            step={s}
                            index={i}
                            isInitial={draft.initialStep === s.name}
                            isSelected={selectedStepId === s.id}
                            hasError={errs.length > 0}
                            hasWarning={warns.length > 0}
                            readOnly={stepsReadOnly}
                            onSelect={() => setSelectedStepId(s.id)}
                            onMakeInitial={() =>
                              setDraft({
                                ...draft,
                                initialStep: draft.initialStep === s.name ? undefined : s.name,
                              })
                            }
                            onRemove={() => void removeStep(i)}
                            onDragStart={() => beginStepDrag(s.id)}
                            onDragOver={() => hoverStepDropTarget(s.id)}
                            onDrop={commitStepReorderFromDrag}
                            onDragEnd={clearStepDragState}
                            isDragging={draggingStepId === s.id}
                            isDropTarget={dropTargetId === s.id && draggingStepId !== s.id}
                          />
                        )
                      })}
                    </div>

                    <div className="min-w-0 flex-1">
                      {selectedStep && selectedDiag ? (
                        <StepCard
                          key={selectedStep.id}
                          step={selectedStep}
                          index={selectedIndex}
                          draft={draft}
                          stepNames={stepNames}
                          workflows={workflows}
                          errors={selectedDiag.errs}
                          warnings={selectedDiag.warns}
                          profileSources={stepProfileSources}
                          candidatesReloadKey={originalYaml}
                          readOnly={stepsReadOnly}
                          onChange={(next) => updateStepAt(selectedIndex, next)}
                          onRename={(o, n) => void renameStep(o, n)}
                        />
                      ) : (
                        <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
                          Select a step on the left to edit.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })()
        : null}

      {tab === 'facets' ? (
        <FacetsTab
          draft={draft}
          setDraft={setDraft}
          requestConfirm={requestConfirm}
          readOnly={yamlOnlyMode}
          onEditInFacets={onEditInFacets}
          onNavigateToSteps={handleNavigateToSteps}
        />
      ) : null}

      {tab === 'advanced' ? (
        <fieldset
          disabled={!formSafe}
          className={cn('flex flex-col gap-3', !formSafe && 'opacity-60')}
        >
          <WorkflowAdvancedTab draft={draft} setDraft={setDraft} readOnly={yamlOnlyMode} />
        </fieldset>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        <p className="text-[11px] text-[var(--color-muted)]">
          Save to:{' '}
          <span className="font-mono">{planetzWorkflowRelPath(draft.name || 'workflow')}</span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => void handleDiscardDraft()}
            disabled={saving || !dirty}
          >
            Discard draft
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => void runValidate()}
            disabled={validating}
          >
            {validating ? 'Validating…' : 'Validate now'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            leading={<FileDiff size={13} />}
            onClick={() => setSaveDiffOpen(true)}
            disabled={!dirty}
          >
            Show diff
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            leading={<Save size={13} />}
            onClick={() => setSaveDiffOpen(true)}
            disabled={!canSaveProject}
          >
            {saving ? 'Saving' : 'Save to project'}
          </Button>
        </div>
      </div>

      {saveError ? <p className="text-xs text-[var(--color-status-failed)]">{saveError}</p> : null}

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {ORBIT_DISPLAY_NAME} workflow doctor
        </p>
        <WorkflowDoctorPanel
          diagnostics={
            routedDiagnostics && routedDiagnostics.global.length > 0
              ? routedDiagnostics.global
              : diagnostics
          }
          loading={validating}
        />
      </div>

      <WorkflowYamlDrawer
        open={yamlDrawerOpen}
        yaml={yamlDrawerText}
        onChange={setYamlDrawerText}
        onClose={() => setYamlDrawerOpen(false)}
        onApplyToForm={() => void applyYamlDrawer()}
        onSaveYaml={() => void handleSave(yamlDrawerText)}
        canSaveYaml={
          !hasDoctorError && yamlDrawerText.trim().length > 0 && yamlDrawerText !== originalYaml
        }
        saving={saving}
      />

      <WorkflowDiffDialog
        open={saveDiffOpen}
        title="Confirm save"
        description={`Write to: ${planetzWorkflowRelPath(draft.name)}`}
        before={originalYaml}
        after={currentYaml}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        confirmDisabled={!canSaveProject}
        onConfirm={() => {
          if (!canSaveProject) return
          void handleSave(undefined)
        }}
        onClose={() => setSaveDiffOpen(false)}
      />

      <WorkflowDiffDialog
        open={!!builtinDiff}
        title={builtinDiff ? `${builtinDiff.name} — project vs builtin` : ''}
        description="Diff vs builtin (preview)"
        before={builtinDiff?.yaml ?? ''}
        after={originalYaml || currentYaml}
        onClose={() => setBuiltinDiff(null)}
      />
    </div>
  )
}
