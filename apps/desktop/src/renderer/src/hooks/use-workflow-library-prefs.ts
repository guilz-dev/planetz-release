import {
  canEnablePackInWorkspace,
  canEnableWorkflowForAuto,
  canEnableWorkflowInWorkspace,
  type WorkflowLibraryUiPrefs,
  type WorkflowPickerSurfacePrefs,
  workflowPickerSurfacePrefsFromUi,
} from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { usePushToast } from './use-toast.js'

function patchWorkflowLibrary(
  current: WorkflowLibraryUiPrefs,
  patch: Partial<WorkflowLibraryUiPrefs>,
): { workflowLibrary: WorkflowLibraryUiPrefs } {
  return {
    workflowLibrary: {
      enabledPacks: patch.enabledPacks ?? current.enabledPacks,
      enabledWorkflows: patch.enabledWorkflows ?? current.enabledWorkflows,
      autoEnabledWorkflows: patch.autoEnabledWorkflows ?? current.autoEnabledWorkflows,
      implicitEnabledWorkflows: patch.implicitEnabledWorkflows ?? current.implicitEnabledWorkflows,
      dismissedImplicitWorkflows:
        patch.dismissedImplicitWorkflows ?? current.dismissedImplicitWorkflows,
    },
  }
}

type EnableRejectReason = 'deprecated' | 'system'

export function useWorkflowLibraryPrefs(enabled = true) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [prefs, setPrefs] = useState<WorkflowPickerSurfacePrefs | null>(null)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => {
    setVersion((value) => value + 1)
  }, [])

  const toastEnableRejection = useCallback(
    (reason?: EnableRejectReason, pack = false) => {
      if (reason === 'deprecated') {
        pushToast({
          kind: 'info',
          message: pack
            ? t('settings.workflowCatalog.enablePackRejectedDeprecated')
            : t('settings.workflowCatalog.enableRejectedDeprecated'),
        })
        return
      }
      if (reason === 'system') {
        pushToast({
          kind: 'info',
          message: t('settings.workflowCatalog.enableRejectedSystem'),
        })
      }
    },
    [pushToast, t],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: version retriggers settings reload
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const getSettings = window.orbit?.getSettings
    if (!getSettings) return
    void getSettings().then(({ config }) => {
      if (cancelled || !config) return
      setPrefs(workflowPickerSurfacePrefsFromUi(config.ui))
    })
    return () => {
      cancelled = true
    }
  }, [enabled, version])

  const updateUi = useCallback(
    async (patch: {
      workflowLibrary?: Partial<WorkflowLibraryUiPrefs>
      pinnedWorkflows?: string[]
      hiddenCoreWorkflows?: string[]
    }) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const library = config.ui.workflowLibrary
      await window.orbit?.updateSettings?.({
        ui: {
          ...(patch.workflowLibrary ? patchWorkflowLibrary(library, patch.workflowLibrary) : {}),
          ...(patch.pinnedWorkflows ? { pinnedWorkflows: patch.pinnedWorkflows } : {}),
          ...(patch.hiddenCoreWorkflows ? { hiddenCoreWorkflows: patch.hiddenCoreWorkflows } : {}),
        },
      })
      refresh()
    },
    [refresh],
  )

  const enableWorkflowInWorkspace = useCallback(
    async (name: string) => {
      const guard = canEnableWorkflowInWorkspace(name)
      if (!guard.allowed) {
        toastEnableRejection(guard.reason)
        refresh()
        return
      }
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.workflowLibrary.enabledWorkflows
      if (current.includes(name)) {
        refresh()
        return
      }
      await updateUi({ workflowLibrary: { enabledWorkflows: [...current, name] } })
    },
    [refresh, toastEnableRejection, updateUi],
  )

  const disableWorkflowInWorkspace = useCallback(
    async (name: string) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.workflowLibrary.enabledWorkflows
      await updateUi({
        workflowLibrary: { enabledWorkflows: current.filter((entry) => entry !== name) },
      })
    },
    [updateUi],
  )

  const enableWorkflowForAuto = useCallback(
    async (name: string) => {
      const guard = canEnableWorkflowForAuto(name)
      if (!guard.allowed) {
        toastEnableRejection(guard.reason)
        refresh()
        return
      }
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.workflowLibrary.autoEnabledWorkflows
      if (current.includes(name)) {
        refresh()
        return
      }
      await updateUi({ workflowLibrary: { autoEnabledWorkflows: [...current, name] } })
    },
    [refresh, toastEnableRejection, updateUi],
  )

  const disableWorkflowForAuto = useCallback(
    async (name: string) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.workflowLibrary.autoEnabledWorkflows
      await updateUi({
        workflowLibrary: { autoEnabledWorkflows: current.filter((entry) => entry !== name) },
      })
    },
    [updateUi],
  )

  const enablePackInWorkspace = useCallback(
    async (packId: string, memberNames: readonly string[] = []) => {
      const guard = canEnablePackInWorkspace(memberNames)
      if (!guard.allowed) {
        toastEnableRejection(guard.reason, true)
        refresh()
        return
      }
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const currentPacks = config.ui.workflowLibrary.enabledPacks
      if (currentPacks.includes(packId)) {
        refresh()
        return
      }
      const currentWorkflows = config.ui.workflowLibrary.enabledWorkflows
      await updateUi({
        workflowLibrary: {
          enabledPacks: [...currentPacks, packId],
          enabledWorkflows: currentWorkflows,
        },
      })
    },
    [refresh, toastEnableRejection, updateUi],
  )

  const togglePinnedCore = useCallback(
    async (name: string) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.pinnedWorkflows
      const next = current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
      await updateUi({ pinnedWorkflows: next })
    },
    [updateUi],
  )

  const toggleHiddenCore = useCallback(
    async (name: string) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const current = config.ui.hiddenCoreWorkflows
      const next = current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
      await updateUi({ hiddenCoreWorkflows: next })
    },
    [updateUi],
  )

  const dismissImplicitWorkflow = useCallback(
    async (name: string) => {
      const getSettings = window.orbit?.getSettings
      if (!getSettings) return
      const { config } = await getSettings()
      if (!config) return
      const dismissed = config.ui.workflowLibrary.dismissedImplicitWorkflows
      if (dismissed.includes(name)) {
        refresh()
        return
      }
      await updateUi({
        workflowLibrary: { dismissedImplicitWorkflows: [...dismissed, name] },
      })
    },
    [refresh, updateUi],
  )

  return {
    prefs,
    refresh,
    enableWorkflowInWorkspace,
    disableWorkflowInWorkspace,
    enableWorkflowForAuto,
    disableWorkflowForAuto,
    enablePackInWorkspace,
    togglePinnedCore,
    toggleHiddenCore,
    dismissImplicitWorkflow,
  }
}
