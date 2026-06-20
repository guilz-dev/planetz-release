import {
  planetzWorkflowRelPath,
  SPEC_DRIVEN_WORKFLOW_NAME,
  type WorkflowDiagnostic,
  type WorkflowSummary,
} from '@planetz/shared'
import { useCallback, useState } from 'react'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache.js'
import type { ConfirmDialogRequest } from '../../hooks/use-confirm-dialog.js'
import { useI18n } from '../../i18n/index.js'
import { copyWorkflowToProject } from '../../lib/copy-workflow-to-project.js'
import type { WorkflowCreateResult } from './workflow-create-dialog.js'
import {
  clearWorkflowDraft,
  collectWorkflowFacetFilesForSave,
  loadWorkflowDraftWithFacets,
  persistWorkflowDraft,
  resolveWorkflowDraftOnOpen,
} from './workflow-draft-persistence.js'
import type { WorkflowDraft } from './workflow-draft-types.js'
import {
  facetContentFingerprint,
  hydrateWorkflowDraftFacets,
} from './workflow-facet-draft-adapter.js'
import { validateWorkflowName } from './workflow-name-utils.js'
import { parseWorkflowYaml } from './workflow-parse.js'
import { serializeWorkflowDraft } from './workflow-serialize.js'

export type WorkflowEditorTab = 'overview' | 'steps' | 'facets' | 'advanced'

export interface UseWorkflowEditorActionsParams {
  workflows: WorkflowSummary[]
  onRefresh: () => Promise<void>
  draft: WorkflowDraft | null
  setDraft: (next: WorkflowDraft | null) => void
  currentYaml: string
  dirty: boolean
  setOriginalYaml: (yaml: string) => void
  setOriginalFacetFingerprint: (fingerprint: string) => void
  setDiagnostics: (next: WorkflowDiagnostic[] | null) => void
  setSelected: (name: string) => void
  setView: (view: 'catalog' | 'editor') => void
  setTab: (tab: WorkflowEditorTab) => void
  setYamlDrawerOpen: (open: boolean) => void
  setYamlDrawerText: (text: string) => void
  setSaveDiffOpen: (open: boolean) => void
  yamlDrawerText: string
  requestConfirm: (payload: ConfirmDialogRequest | string) => Promise<boolean>
}

export function useWorkflowEditorActions({
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
}: UseWorkflowEditorActionsParams) {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [duplicateSource, setDuplicateSource] = useState<string | null>(null)
  const [nameDialogError, setNameDialogError] = useState<string | null>(null)
  const [builtinDiff, setBuiltinDiff] = useState<{ name: string; yaml: string } | null>(null)

  const resetEditorSession = useCallback(() => {
    setDraft(null)
    setOriginalYaml('')
    setOriginalFacetFingerprint('')
    setDiagnostics(null)
  }, [setDiagnostics, setDraft, setOriginalFacetFingerprint, setOriginalYaml])

  const handleOpen = useCallback(
    async (name: string, options?: { openYaml?: boolean }) => {
      setSelected(name)
      setView('editor')
      setTab('overview')
      setSaveError(null)
      setDiagnostics(null)
      setYamlDrawerOpen(options?.openYaml ?? false)
      try {
        const res = await window.orbit.readWorkflow({ nameOrPath: name })
        const { yaml, restoreDrafts, facetDraftSnapshot } = await resolveWorkflowDraftOnOpen(
          name,
          res.yaml,
          {
            confirmRestoreDraft: async (message) =>
              requestConfirm({
                title: 'Unsaved draft',
                message,
                confirmLabel: 'Restore',
              }),
          },
        )
        setOriginalYaml(res.yaml)
        const parsed = parseWorkflowYaml(yaml)
        let hydrated = await loadWorkflowDraftWithFacets(parsed)
        if (restoreDrafts && facetDraftSnapshot) {
          hydrated = hydrateWorkflowDraftFacets(
            hydrated,
            Object.entries(facetDraftSnapshot).map(([managedPath, content]) => ({
              managedPath,
              content,
            })),
            { overwriteExisting: true },
          )
        }
        setDraft(hydrated)
        setOriginalFacetFingerprint(facetContentFingerprint(hydrated))
        setYamlDrawerText(yaml)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    },
    [
      setDiagnostics,
      setDraft,
      setOriginalFacetFingerprint,
      setOriginalYaml,
      setSelected,
      setTab,
      setView,
      setYamlDrawerOpen,
      setYamlDrawerText,
      requestConfirm,
    ],
  )

  const handleBack = useCallback(() => {
    void (async () => {
      if (dirty && draft) void persistWorkflowDraft(draft, currentYaml)
      if (
        dirty &&
        !(await requestConfirm('You have unsaved changes. Discard and return to the catalog?'))
      ) {
        return
      }
      setView('catalog')
      resetEditorSession()
    })()
  }, [currentYaml, dirty, draft, requestConfirm, resetEditorSession, setView])

  const handleCreateNew = useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  const openNewWorkflowEditor = useCallback(
    async (result: WorkflowCreateResult, options?: { persistedYaml?: string }) => {
      const yaml = serializeWorkflowDraft(result.draft)
      setSelected(result.draft.name)
      setOriginalYaml(options?.persistedYaml ?? '')
      const hydrated = await loadWorkflowDraftWithFacets(result.draft)
      setDraft(hydrated)
      setOriginalFacetFingerprint(facetContentFingerprint(hydrated))
      setView('editor')
      setTab('overview')
      setSaveError(null)
      setDiagnostics(null)
      setYamlDrawerOpen(false)
      setYamlDrawerText(yaml)
      setCreateDialogOpen(false)
    },
    [
      setDiagnostics,
      setDraft,
      setOriginalFacetFingerprint,
      setOriginalYaml,
      setSelected,
      setTab,
      setView,
      setYamlDrawerOpen,
      setYamlDrawerText,
    ],
  )

  const handleCreateConfirm = useCallback(
    async (result: WorkflowCreateResult) => {
      const yaml = serializeWorkflowDraft(result.draft)
      if (result.installSpecDriven) {
        try {
          await window.orbit.installSpecDrivenWorkflow()
          const saved = await window.orbit.readWorkflow({
            nameOrPath: SPEC_DRIVEN_WORKFLOW_NAME,
            source: 'project',
          })
          const savedDraft = parseWorkflowYaml(saved.yaml)
          await onRefresh()
          await openNewWorkflowEditor(
            { ...result, draft: savedDraft },
            { persistedYaml: saved.yaml },
          )
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err))
        }
        return
      }
      if (result.importSourcePath) {
        try {
          await window.orbit.writeProjectWorkflow({ name: result.draft.name, yaml })
          await onRefresh()
          await openNewWorkflowEditor(result, { persistedYaml: yaml })
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err))
        }
        return
      }
      await openNewWorkflowEditor(result)
    },
    [onRefresh, openNewWorkflowEditor],
  )

  const openDuplicateDialog = useCallback((name: string) => {
    setDuplicateDialogOpen(true)
    setNameInput(`${name}-copy`)
    setDuplicateSource(name)
    setNameDialogError(null)
  }, [])

  const closeDuplicateDialog = useCallback(() => {
    setDuplicateDialogOpen(false)
    setDuplicateSource(null)
    setNameDialogError(null)
  }, [])

  const finishDuplicate = useCallback(
    async (name: string, sourceName: string) => {
      try {
        const res = await window.orbit.readWorkflow({ nameOrPath: sourceName })
        const parsed = parseWorkflowYaml(res.yaml)
        parsed.name = name
        const yaml = serializeWorkflowDraft(parsed)
        await window.orbit.writeProjectWorkflow({ name, yaml })
        await onRefresh()
        closeDuplicateDialog()
        await handleOpen(name)
      } catch (err) {
        setNameDialogError(err instanceof Error ? err.message : String(err))
      }
    },
    [closeDuplicateDialog, handleOpen, onRefresh],
  )

  const submitDuplicateDialog = useCallback(async () => {
    const err = validateWorkflowName(nameInput)
    if (err) {
      setNameDialogError(err)
      return
    }
    const normalized = nameInput.trim()
    if (duplicateSource) {
      await finishDuplicate(normalized, duplicateSource)
    }
  }, [duplicateSource, finishDuplicate, nameInput])

  const handleCopyToProject = useCallback(
    async (name: string) => {
      try {
        const result = await copyWorkflowToProject({
          name,
          workflows,
          confirmOverwrite: async (workflowName) =>
            requestConfirm({
              title: t('settings.workflowCatalog.copyToProjectOverwriteTitle'),
              message: t('settings.workflowCatalog.copyToProjectOverwriteMessage', {
                name: workflowName,
              }),
              confirmLabel: t('settings.workflowCatalog.copyToProjectOverwriteConfirm'),
            }),
        })
        if (result === 'cancelled') return
        if (result === 'failed') {
          setSaveError(`Failed to copy workflow "${name}" to project`)
          return
        }
        await onRefresh()
        await handleOpen(name)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    },
    [handleOpen, onRefresh, requestConfirm, t, workflows],
  )

  const handleReimportFromTakt = useCallback(async () => {
    if (!draft?.name.trim()) return
    const name = draft.name.trim()
    if (
      !(await requestConfirm({
        title: 'Re-import from isolated .takt',
        message: `Import "${name}" from isolated .takt into ${planetzWorkflowRelPath(name)}? This overwrites the Planetz copy only.`,
      }))
    ) {
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await window.orbit.importWorkflowFromTakt({ name, overwrite: true })
      await onRefresh()
      await handleOpen(name)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [draft, handleOpen, onRefresh, requestConfirm])

  const handleDiffVsBuiltin = useCallback(async (name: string) => {
    try {
      const builtin = await window.orbit.readWorkflow({ nameOrPath: name, source: 'builtin' })
      setBuiltinDiff({ name, yaml: builtin.yaml })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleSave = useCallback(
    async (yamlToWrite?: string) => {
      if (!draft) return
      const yaml = yamlToWrite ?? currentYaml
      setSaving(true)
      setSaveError(null)
      try {
        await window.orbit.writeProjectWorkflow({
          name: draft.name,
          yaml,
          facetFiles: collectWorkflowFacetFilesForSave(draft),
        })
        setDiagnostics([])
        setOriginalYaml(yaml)
        const reparsed = parseWorkflowYaml(yaml)
        const hydrated = await loadWorkflowDraftWithFacets(reparsed)
        setDraft(hydrated)
        setOriginalFacetFingerprint(facetContentFingerprint(hydrated))
        await clearWorkflowDraft(draft.name)
        await onRefresh()
        invalidateProviderModelsCache()
        setSaveDiffOpen(false)
        setYamlDrawerOpen(false)
      } catch (err) {
        const e = err as { code?: string; message?: string }
        setSaveError(e.message ?? String(err))
      } finally {
        setSaving(false)
      }
    },
    [
      currentYaml,
      draft,
      onRefresh,
      setDiagnostics,
      setDraft,
      setOriginalFacetFingerprint,
      setOriginalYaml,
      setSaveDiffOpen,
      setYamlDrawerOpen,
    ],
  )

  const applyYamlDrawer = useCallback(async () => {
    const parsed = parseWorkflowYaml(yamlDrawerText)
    const hydrated = await loadWorkflowDraftWithFacets(parsed)
    setDraft(hydrated)
    setYamlDrawerOpen(false)
  }, [setDraft, setYamlDrawerOpen, yamlDrawerText])

  const handleDiscardDraft = useCallback(async () => {
    if (!draft) return
    const hasUnsaved = dirty
    if (
      hasUnsaved &&
      !(await requestConfirm({
        title: 'Discard draft',
        message: `Discard unsaved edits for "${draft.name || 'workflow'}"? This cannot be undone.`,
      }))
    ) {
      return
    }
    await clearWorkflowDraft(draft.name)
    setSaveDiffOpen(false)
    setYamlDrawerOpen(false)
    setSaveError(null)
    resetEditorSession()
    setSelected('')
    setView('catalog')
  }, [
    draft,
    dirty,
    requestConfirm,
    resetEditorSession,
    setSaveDiffOpen,
    setSelected,
    setView,
    setYamlDrawerOpen,
  ])

  return {
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
  }
}
