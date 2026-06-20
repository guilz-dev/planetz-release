import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { isWorkspaceNotFoundError } from '../lib/workspace-switch-errors.js'
import { pickCloseFallbackPath } from '../lib/workspace-tab-labels.js'
import type { WorkspaceUiTab } from '../lib/workspace-ui-tab.js'
import { useAppStore } from '../store/app-store'
import { usePushToast } from './use-toast'

export type { WorkspaceUiTab } from '../lib/workspace-ui-tab.js'

export const WORKSPACE_TABS_STORAGE_KEY = 'planetz.ui.workspaceTabs.v1'

function readStoredTabs(): WorkspaceUiTab[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(WORKSPACE_TABS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is WorkspaceUiTab =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as WorkspaceUiTab).path === 'string' &&
        typeof (entry as WorkspaceUiTab).name === 'string',
    )
  } catch {
    return []
  }
}

function writeStoredTabs(tabs: WorkspaceUiTab[]): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (tabs.length === 0) {
      sessionStorage.removeItem(WORKSPACE_TABS_STORAGE_KEY)
      return
    }
    sessionStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // Ignore quota or privacy errors.
  }
}

function appendUniqueTabs(
  current: WorkspaceUiTab[],
  entries: Array<{ path: string; name: string }>,
): WorkspaceUiTab[] {
  const next = [...current]
  for (const entry of entries) {
    const existingIndex = next.findIndex((tab) => tab.path === entry.path)
    if (existingIndex < 0) {
      next.push({ path: entry.path, name: entry.name })
      continue
    }
    const existing = next[existingIndex]
    if (existing && existing.name !== entry.name) {
      next[existingIndex] = { path: entry.path, name: entry.name }
    }
  }
  return next
}

export function useWorkspaceTabs() {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [tabs, setTabs] = useState<WorkspaceUiTab[]>(() => readStoredTabs())
  const switchWorkspaceRef = useRef<(path: string) => Promise<boolean>>(async () => false)

  useEffect(() => {
    writeStoredTabs(tabs)
  }, [tabs])

  const bindSwitchWorkspace = useCallback((fn: (path: string) => Promise<boolean>) => {
    switchWorkspaceRef.current = fn
  }, [])

  const removeTab = useCallback((path: string) => {
    setTabs((current) => current.filter((tab) => tab.path !== path))
  }, [])

  const recordTransition = useCallback(
    (prevPath: string, nextPath: string, names: { prevName: string; nextName: string }) => {
      setTabs((current) =>
        appendUniqueTabs(current, [
          { path: prevPath, name: names.prevName },
          { path: nextPath, name: names.nextName },
        ]),
      )
    },
    [],
  )

  const reportSwitchFailure = useCallback(
    (error: unknown, staleTabPath?: string) => {
      pushToast({
        kind: 'error',
        title: t('workspaceTabs.switchErrorTitle'),
        message: error instanceof Error ? error.message : t('workspaceTabs.switchError'),
      })
      if (staleTabPath && isWorkspaceNotFoundError(error)) {
        removeTab(staleTabPath)
      }
    },
    [pushToast, removeTab, t],
  )

  const selectTab = useCallback(async (path: string) => {
    if (useAppStore.getState().workspaceSwitching) return
    const activePath = useAppStore.getState().state?.workspace.path ?? ''
    if (path === activePath) return
    await switchWorkspaceRef.current(path)
  }, [])

  const closeTab = useCallback(
    async (path: string) => {
      if (useAppStore.getState().workspaceSwitching) return

      const activePath = useAppStore.getState().state?.workspace.path ?? ''
      if (path !== activePath) {
        removeTab(path)
        return
      }

      if (tabs.length < 2) return

      const fallbackPath = pickCloseFallbackPath(tabs, path)
      if (!fallbackPath) return

      const switched = await switchWorkspaceRef.current(fallbackPath)
      if (switched) {
        removeTab(path)
      }
    },
    [removeTab, tabs],
  )

  return {
    tabs,
    recordTransition,
    selectTab,
    closeTab,
    bindSwitchWorkspace,
    reportSwitchFailure,
  }
}
