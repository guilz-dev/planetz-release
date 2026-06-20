import type { FacetKind, WorkflowSummary } from '@planetz/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirmDialog } from '../../hooks/use-confirm-dialog.js'
import { useExecutionOptionSources } from '../../hooks/use-execution-option-sources'
import { useWorkflowEditorActions, type WorkflowEditorTab } from './use-workflow-editor-actions.js'
import { useWorkflowStepEditing } from './use-workflow-step-editing.js'
import { useWorkflowValidation } from './use-workflow-validation.js'
import { findDanglingRefs } from './workflow-diagnostics.js'
import { persistWorkflowDraft } from './workflow-draft-persistence.js'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { WorkflowEditorCatalogView } from './workflow-editor-catalog-view.js'
import { WorkflowEditorWorkspaceView } from './workflow-editor-workspace-view.js'
import { facetContentFingerprint } from './workflow-facet-draft-adapter.js'
import { validateInitialStep, validateWorkflowName } from './workflow-name-utils.js'
import {
  readonlyReasonForDraft,
  workflowFormBanner,
  workflowFormMode,
} from './workflow-readonly.js'
import { serializeWorkflowDraft } from './workflow-serialize.js'

interface WorkflowEditorProps {
  workflows: WorkflowSummary[]
  builtinWorkflowCategoryOrder?: string[]
  onRefresh: () => Promise<void>
  /** When this number changes, open the new-workflow editor (Compose order + New, etc.). */
  createRequest?: number
  onEditInFacets?: (selection: { kind: FacetKind; key: string }) => void
  catalogWorkflowFilter?: ReadonlySet<string> | null
  catalogWorkflowFilterLabel?: string | null
  onClearCatalogWorkflowFilter?: () => void
}

type StepsView = 'list' | 'graph'

export function WorkflowEditor({
  workflows,
  builtinWorkflowCategoryOrder: _builtinWorkflowCategoryOrder,
  onRefresh,
  createRequest = 0,
  onEditInFacets,
  catalogWorkflowFilter = null,
  catalogWorkflowFilterLabel = null,
  onClearCatalogWorkflowFilter,
}: WorkflowEditorProps) {
  const { requestConfirm, confirmDialog } = useConfirmDialog()

  const [view, setView] = useState<'catalog' | 'editor'>('catalog')
  const [selected, setSelected] = useState<string>('')
  const [originalYaml, setOriginalYaml] = useState('')
  const [originalFacetFingerprint, setOriginalFacetFingerprint] = useState('')
  const [draft, setDraft] = useState<WorkflowDraft | null>(null)
  const [tab, setTab] = useState<WorkflowEditorTab>('overview')
  const [stepsView, setStepsView] = useState<StepsView>('list')
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [yamlDrawerOpen, setYamlDrawerOpen] = useState(false)
  const [yamlDrawerText, setYamlDrawerText] = useState('')
  const [saveDiffOpen, setSaveDiffOpen] = useState(false)
  const handledCreateRequest = useRef(0)

  const summary = workflows.find((w) => w.name === selected)
  const currentYaml = useMemo(() => (draft ? serializeWorkflowDraft(draft) : ''), [draft])

  const {
    diagnostics,
    setDiagnostics,
    validating,
    runValidate,
    routedDiagnostics,
    hasDoctorError,
  } = useWorkflowValidation({ view, draft, selected, currentYaml })

  const facetDirty = useMemo(
    () => (draft ? facetContentFingerprint(draft) !== originalFacetFingerprint : false),
    [draft, originalFacetFingerprint],
  )
  const dirty = currentYaml !== originalYaml || facetDirty

  const {
    saving,
    saveError,
    createDialogOpen,
    setCreateDialogOpen,
    duplicateDialogOpen,
    nameInput,
    setNameInput,
    nameDialogError,
    builtinDiff,
    setBuiltinDiff,
    handleOpen,
    handleBack,
    handleCreateNew,
    handleCreateConfirm,
    openDuplicateDialog,
    closeDuplicateDialog,
    submitDuplicateDialog,
    handleCopyToProject,
    handleReimportFromTakt,
    handleDiffVsBuiltin,
    handleSave,
    applyYamlDrawer,
    handleDiscardDraft,
  } = useWorkflowEditorActions({
    workflows,
    onRefresh,
    draft,
    setDraft,
    currentYaml,
    dirty,
    setOriginalYaml,
    setOriginalFacetFingerprint,
    setDiagnostics,
    setSelected,
    setView,
    setTab,
    setYamlDrawerOpen,
    setYamlDrawerText,
    setSaveDiffOpen,
    yamlDrawerText,
    requestConfirm,
  })

  const stepEditing = useWorkflowStepEditing({
    draft,
    setDraft,
    selectedStepId,
    setSelectedStepId,
    requestConfirm,
  })

  const executionOptions = useExecutionOptionSources({
    workflowName: view === 'editor' ? selected : undefined,
    workflowYaml: view === 'editor' ? currentYaml : undefined,
  })
  const formMode = useMemo(() => {
    if (!draft) return 'full' as const
    const t = originalYaml.trim()
    return workflowFormMode(draft, t.length > 0 ? t : undefined)
  }, [draft, originalYaml])
  const readonlyReason = useMemo(() => {
    if (!draft) return null
    const t = originalYaml.trim()
    return readonlyReasonForDraft(draft, t.length > 0 ? t : undefined)
  }, [draft, originalYaml])
  const partialBanner = useMemo(() => {
    if (!draft) return null
    const t = originalYaml.trim()
    return workflowFormBanner(draft, t.length > 0 ? t : undefined)
  }, [draft, originalYaml])
  const yamlOnlyMode = formMode === 'yaml-only'
  const danglingRefs = useMemo(() => (draft ? findDanglingRefs(draft) : []), [draft])
  const workflowNameError = draft ? validateWorkflowName(draft.name) : null
  const initialStepError = draft ? validateInitialStep(draft) : null
  const canSaveProject =
    !saving &&
    workflowNameError == null &&
    initialStepError == null &&
    !hasDoctorError &&
    dirty &&
    !yamlOnlyMode

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view !== 'editor') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setYamlDrawerOpen((v) => {
          if (!v) setYamlDrawerText(currentYaml)
          return !v
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, currentYaml])

  useEffect(() => {
    if (!draft || draft.steps.length === 0) {
      if (selectedStepId !== null) setSelectedStepId(null)
      return
    }
    if (!selectedStepId || !draft.steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(draft.steps[0].id)
    }
  }, [draft, selectedStepId])

  useEffect(() => {
    if (createRequest <= 0 || createRequest === handledCreateRequest.current) return
    handledCreateRequest.current = createRequest
    handleCreateNew()
  }, [createRequest, handleCreateNew])

  useEffect(() => {
    if (view !== 'editor' || !draft || !dirty) return
    void persistWorkflowDraft(draft, currentYaml)
    const onLeave = () => void persistWorkflowDraft(draft, currentYaml)
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [view, draft, dirty, currentYaml])

  if (view === 'catalog') {
    return (
      <>
        <WorkflowEditorCatalogView
          workflows={workflows}
          workflowNameFilter={catalogWorkflowFilter}
          workflowFilterLabel={catalogWorkflowFilterLabel}
          onClearWorkflowFilter={onClearCatalogWorkflowFilter}
          onRefreshCatalogOpen={handleOpen}
          handleCopyToProject={handleCopyToProject}
          openDuplicateDialog={openDuplicateDialog}
          handleDiffVsBuiltin={handleDiffVsBuiltin}
          handleCreateNew={handleCreateNew}
          createDialogOpen={createDialogOpen}
          setCreateDialogOpen={setCreateDialogOpen}
          handleCreateConfirm={handleCreateConfirm}
          duplicateDialogOpen={duplicateDialogOpen}
          closeDuplicateDialog={closeDuplicateDialog}
          submitDuplicateDialog={submitDuplicateDialog}
          nameInput={nameInput}
          setNameInput={setNameInput}
          nameDialogError={nameDialogError}
        />
        {confirmDialog}
      </>
    )
  }

  if (!draft) {
    return (
      <>
        <p className="text-xs text-[var(--color-muted)]">Loading {selected}…</p>
        {confirmDialog}
      </>
    )
  }

  const {
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
  } = stepEditing

  return (
    <>
      <WorkflowEditorWorkspaceView
        draft={draft}
        setDraft={setDraft}
        summary={summary}
        dirty={dirty}
        saving={saving}
        saveError={saveError}
        currentYaml={currentYaml}
        originalYaml={originalYaml}
        canSaveProject={canSaveProject}
        diagnostics={diagnostics}
        routedDiagnostics={routedDiagnostics}
        hasDoctorError={hasDoctorError}
        validating={validating}
        runValidate={runValidate}
        yamlOnlyMode={yamlOnlyMode}
        formMode={formMode}
        readonlyReason={readonlyReason}
        partialBanner={partialBanner}
        formSafe={formMode !== 'yaml-only'}
        workflows={workflows}
        danglingRefs={danglingRefs}
        tab={tab}
        setTab={setTab}
        stepsView={stepsView}
        setStepsView={setStepsView}
        yamlDrawerOpen={yamlDrawerOpen}
        setYamlDrawerOpen={setYamlDrawerOpen}
        yamlDrawerText={yamlDrawerText}
        setYamlDrawerText={setYamlDrawerText}
        saveDiffOpen={saveDiffOpen}
        setSaveDiffOpen={setSaveDiffOpen}
        builtinDiff={builtinDiff}
        setBuiltinDiff={setBuiltinDiff}
        selectedStepId={selectedStepId}
        setSelectedStepId={setSelectedStepId}
        handleBack={handleBack}
        handleReimportFromTakt={handleReimportFromTakt}
        handleDiscardDraft={handleDiscardDraft}
        handleSave={handleSave}
        applyYamlDrawer={applyYamlDrawer}
        draggingStepId={draggingStepId}
        dropTargetId={dropTargetId}
        updateStepAt={updateStepAt}
        renameStep={renameStep}
        addStep={addStep}
        beginStepDrag={beginStepDrag}
        hoverStepDropTarget={hoverStepDropTarget}
        clearStepDragState={clearStepDragState}
        clearDropTarget={clearDropTarget}
        commitStepReorderFromDrag={commitStepReorderFromDrag}
        removeStep={removeStep}
        requestConfirm={requestConfirm}
        stepProfileSources={{
          engineConfig: executionOptions.engineConfig,
          catalog: executionOptions.catalog,
          workflowDefaults: executionOptions.workflowDefaults,
        }}
        onEditInFacets={onEditInFacets}
      />
      {confirmDialog}
    </>
  )
}
