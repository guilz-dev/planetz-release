import type { UiConfig, WorkspaceState } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import type { FacetSelection } from '../components/settings/settings-facets-panel'
import type { SettingsTab } from '../components/settings-modal'
import { useAppStore } from '../store/app-store'
import { useChainActions } from './use-chain-actions'
import { useIntegrationActions } from './use-integration-actions'
import { useRetryActions } from './use-retry-actions'
import { useWorkspaceBootstrap } from './use-workspace-bootstrap'
import { useWorkspaceTabs } from './use-workspace-tabs'

export function useWorkspaceSession() {
  const {
    opening,
    hydrating,
    checkingCli,
    recentWorkspaces,
    openWorkspace: bootstrapOpenWorkspace,
    openRecentWorkspace: bootstrapOpenRecentWorkspace,
    removeRecentWorkspace,
    recheckCli,
    refreshPromptHistory,
    syncUiPreferencesFromConfig,
  } = useWorkspaceBootstrap()
  const retry = useRetryActions()
  const chain = useChainActions()
  const integration = useIntegrationActions()
  const { tabs, recordTransition, selectTab, closeTab, bindSwitchWorkspace, reportSwitchFailure } =
    useWorkspaceTabs()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsConfig, setSettingsConfig] = useState<UiConfig | null>(null)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | null>(null)
  const [settingsInitialFacetSelection, setSettingsInitialFacetSelection] =
    useState<FacetSelection | null>(null)
  const [workflowCreateRequest, setWorkflowCreateRequest] = useState(0)
  const workspaceBootstrap = useAppStore((s) => s.state?.workspace.bootstrap)

  useEffect(() => {
    if (workspaceBootstrap !== 'takt_ready') return
    void window.orbit.getSettings().then(({ config }) => {
      setSettingsConfig(config)
    })
  }, [workspaceBootstrap])

  const recordIfSwitched = useCallback(
    (prev: WorkspaceState | undefined, next: WorkspaceState | undefined) => {
      if (prev?.path && next?.path && prev.path !== next.path) {
        recordTransition(prev.path, next.path, {
          prevName: prev.name,
          nextName: next.name,
        })
      }
    },
    [recordTransition],
  )

  const openRecentWorkspace = useCallback(
    async (path: string): Promise<boolean> => {
      const prev = useAppStore.getState().state?.workspace
      try {
        const switched = await bootstrapOpenRecentWorkspace(path)
        if (!switched) return false
        recordIfSwitched(prev, useAppStore.getState().state?.workspace)
        const { config } = await window.orbit.getSettings()
        setSettingsConfig(config)
        return true
      } catch (error) {
        reportSwitchFailure(error, path)
        throw error instanceof Error ? error : new Error(String(error))
      }
    },
    [bootstrapOpenRecentWorkspace, recordIfSwitched, reportSwitchFailure],
  )

  const switchWorkspaceFromTab = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        return await openRecentWorkspace(path)
      } catch {
        return false
      }
    },
    [openRecentWorkspace],
  )

  useEffect(() => {
    bindSwitchWorkspace(switchWorkspaceFromTab)
  }, [bindSwitchWorkspace, switchWorkspaceFromTab])

  const openWorkspace = useCallback(async () => {
    const prev = useAppStore.getState().state?.workspace
    try {
      const result = await bootstrapOpenWorkspace()
      if (result && !result.canceled) {
        recordIfSwitched(prev, useAppStore.getState().state?.workspace)
        const { config } = await window.orbit.getSettings()
        setSettingsConfig(config)
      }
    } catch (error) {
      reportSwitchFailure(error)
    }
  }, [bootstrapOpenWorkspace, recordIfSwitched, reportSwitchFailure])

  const onSelectWorkspaceTab = useCallback(
    (path: string) => {
      void selectTab(path)
    },
    [selectTab],
  )

  const onCloseWorkspaceTab = useCallback(
    (path: string) => {
      void closeTab(path)
    },
    [closeTab],
  )

  const openSettings = useCallback(async () => {
    const { config } = await window.orbit.getSettings()
    setSettingsConfig(config)
    setSettingsInitialTab(null)
    setSettingsInitialFacetSelection(null)
    setSettingsOpen(true)
  }, [])

  const openSettingsToFacets = useCallback(async (selection: FacetSelection) => {
    const { config } = await window.orbit.getSettings()
    setSettingsConfig(config)
    setSettingsInitialFacetSelection(selection)
    setSettingsInitialTab('facets')
    setSettingsOpen(true)
  }, [])

  const openSettingsToIntegrations = useCallback(async () => {
    const { config } = await window.orbit.getSettings()
    setSettingsConfig(config)
    setSettingsInitialFacetSelection(null)
    setSettingsInitialTab('integrations')
    setSettingsOpen(true)
  }, [])

  const openNewWorkflow = useCallback(() => {
    useAppStore.getState().setActiveView('workflow')
    setWorkflowCreateRequest((n) => n + 1)
  }, [])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsInitialTab(null)
    setSettingsInitialFacetSelection(null)
  }, [])

  const onSettingsSaved = useCallback(async () => {
    const { config } = await window.orbit.getSettings()
    syncUiPreferencesFromConfig(config)
    setSettingsConfig(config)
    await recheckCli()
  }, [syncUiPreferencesFromConfig, recheckCli])

  return {
    bootstrap: {
      opening,
      hydrating,
    },
    workspace: {
      checkingCli,
      recentWorkspaces,
      tabs,
      onChangeWorkspace: openWorkspace,
      onOpenRecentWorkspace: openRecentWorkspace,
      onRemoveRecentWorkspace: removeRecentWorkspace,
      onRefreshPromptHistory: refreshPromptHistory,
      onRecheckCli: recheckCli,
      onSelectWorkspaceTab,
      onCloseWorkspaceTab,
    },
    settings: {
      settingsOpen,
      settingsConfig,
      settingsInitialTab,
      settingsInitialFacetSelection,
      workflowCreateRequest,
      onOpenSettings: openSettings,
      onOpenSettingsToFacets: openSettingsToFacets,
      onOpenSettingsToIntegrations: openSettingsToIntegrations,
      onNewWorkflow: openNewWorkflow,
      onCloseSettings: closeSettings,
      onSettingsSaved,
    },
    retry: {
      retryDialog: retry.retryDialog,
      retryBusy: retry.retryBusy,
      onRequestRetryAction: retry.requestRetryAction,
      onCloseRetryDialog: retry.closeRetryDialog,
      onConfirmRetryAction: retry.confirmRetryAction,
    },
    chain: {
      chainDialog: chain.chainDialog,
      chainBusy: chain.chainBusy,
      onRequestCreateChain: chain.requestCreateChain,
      onCloseChainDialog: chain.closeChainDialog,
      onConfirmChainCreate: chain.confirmChainCreate,
      onUnlinkChainEdge: chain.unlinkChainEdge,
      onMaterializeChain: chain.materializeChain,
      chainMaterializeBusy: chain.chainMaterializeBusy,
      chainMaterializeWarning: chain.chainMaterializeWarning,
    },
    integration: {
      hookBearerSecret: integration.hookBearerSecret,
      onDismissHookBearerSecret: () => integration.setHookBearerSecret(null),
      onToggleHookServer: integration.toggleHookServer,
      onToggleAdapter: integration.toggleAdapter,
      onPushAdapter: integration.pushAdapter,
    },
  }
}
