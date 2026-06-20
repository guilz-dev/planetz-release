import type { RecentWorkspace } from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/app-store'
import { clearTaskProjection } from '../store/clear-task-projection'
import { syncUiPreferencesFromConfig } from '../store/sync-ui-preferences'

const PROMPT_HISTORY_LIMIT = 20

async function syncPromptHistory(): Promise<void> {
  const items = await window.orbit.listPromptHistory({ limit: PROMPT_HISTORY_LIMIT })
  useAppStore.getState().setPromptHistory(items)
}

function beginWorkspaceSwitch(): void {
  const store = useAppStore.getState()
  store.setWorkspaceSwitching(true)
  if (store.state) {
    store.setState(clearTaskProjection(store.state))
  }
}

async function endWorkspaceSwitch(): Promise<void> {
  useAppStore.getState().setWorkspaceSwitching(false)
}

export function useWorkspaceBootstrap() {
  const [opening, setOpening] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [checkingCli, setCheckingCli] = useState(false)
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
  const workspaceSwitchGuard = useRef(false)

  const beginExclusiveWorkspaceSwitch = useCallback((): boolean => {
    if (workspaceSwitchGuard.current) return false
    workspaceSwitchGuard.current = true
    beginWorkspaceSwitch()
    return true
  }, [])

  const endExclusiveWorkspaceSwitch = useCallback(async () => {
    workspaceSwitchGuard.current = false
    await endWorkspaceSwitch()
  }, [])

  const refreshRecentWorkspaces = useCallback(async () => {
    const recents = await window.orbit.listRecentWorkspaces()
    setRecentWorkspaces(recents)
  }, [])

  useEffect(() => {
    if (typeof window.orbit === 'undefined') return

    const unsubState = window.orbit.onStateUpdate((next) => {
      useAppStore.getState().setState(next)
    })
    const unsubFocusTask = window.orbit.onUiFocusTask((taskId) => {
      const store = useAppStore.getState()
      store.setActiveView('task')
      store.setSelectedTaskId(taskId)
    })
    void window.orbit
      .getWorkspace()
      .then(async ({ state: initial }) => {
        if (initial) useAppStore.getState().setState(initial)
        const { config } = await window.orbit.getSettings()
        syncUiPreferencesFromConfig(config)
        await syncPromptHistory()
        await refreshRecentWorkspaces()
      })
      .finally(() => {
        setHydrating(false)
      })
    return () => {
      unsubState()
      unsubFocusTask()
    }
  }, [refreshRecentWorkspaces])

  const openWorkspace = useCallback(async () => {
    if (!beginExclusiveWorkspaceSwitch()) {
      return { canceled: true as const }
    }
    setOpening(true)
    try {
      const result = await window.orbit.selectWorkspace()
      if (!result.canceled) {
        useAppStore.getState().setState(result.state)
        const { config } = await window.orbit.getSettings()
        syncUiPreferencesFromConfig(config)
        await syncPromptHistory()
        await refreshRecentWorkspaces()
      } else {
        const { state: current } = await window.orbit.getWorkspace()
        if (current) useAppStore.getState().setState(current)
      }
      return result
    } finally {
      await endExclusiveWorkspaceSwitch()
      setOpening(false)
    }
  }, [beginExclusiveWorkspaceSwitch, endExclusiveWorkspaceSwitch, refreshRecentWorkspaces])

  const removeRecentWorkspace = useCallback(async (path: string) => {
    const recents = await window.orbit.removeRecentWorkspace({ path })
    setRecentWorkspaces(recents)
  }, [])

  const openRecentWorkspace = useCallback(
    async (path: string) => {
      if (!beginExclusiveWorkspaceSwitch()) return false
      setOpening(true)
      try {
        const result = await window.orbit.openRecentWorkspace({ path })
        useAppStore.getState().setState(result.state)
        const { config } = await window.orbit.getSettings()
        syncUiPreferencesFromConfig(config)
        await syncPromptHistory()
        await refreshRecentWorkspaces()
        return true
      } finally {
        await endExclusiveWorkspaceSwitch()
        setOpening(false)
      }
    },
    [beginExclusiveWorkspaceSwitch, endExclusiveWorkspaceSwitch, refreshRecentWorkspaces],
  )

  const recheckCli = useCallback(async () => {
    setCheckingCli(true)
    try {
      await window.orbit.getConnectionStatus()
    } finally {
      setCheckingCli(false)
    }
  }, [])

  const refreshPromptHistory = useCallback(async () => {
    await syncPromptHistory()
  }, [])

  return {
    opening,
    hydrating,
    checkingCli,
    recentWorkspaces,
    openWorkspace,
    openRecentWorkspace,
    removeRecentWorkspace,
    recheckCli,
    refreshPromptHistory,
    syncUiPreferencesFromConfig,
  }
}
