import type { WorkspaceUiTab } from './workspace-ui-tab.js'

function parentSuffixForPath(path: string): string {
  const normalized = path.replace(/\/$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) return ''
  const parent = normalized.slice(0, lastSlash)
  const parts = parent.split('/').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  return parts[parts.length - 1] ?? ''
}

/** Display label for a workspace tab; disambiguates duplicate basenames. */
export function formatWorkspaceTabLabel(
  tab: WorkspaceUiTab,
  allTabs: ReadonlyArray<WorkspaceUiTab>,
): string {
  const duplicateNames = allTabs.filter((entry) => entry.name === tab.name).length > 1
  if (!duplicateNames) return tab.name
  const suffix = parentSuffixForPath(tab.path)
  return suffix ? `${tab.name} · ${suffix}` : tab.name
}

export function pickCloseFallbackPath(
  tabs: ReadonlyArray<WorkspaceUiTab>,
  closingPath: string,
): string | null {
  const index = tabs.findIndex((tab) => tab.path === closingPath)
  if (index < 0) return null
  if (index > 0) return tabs[index - 1]?.path ?? null
  if (index < tabs.length - 1) return tabs[index + 1]?.path ?? null
  return null
}
