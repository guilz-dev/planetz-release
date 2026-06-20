import type { WorkflowSummary } from '@planetz/shared'
import {
  buildTierAwareWorkflowGroups,
  resolveRecentWorkflowItems,
  type WorkflowGroup,
  type WorkflowPickerSurfacePrefs,
} from '@planetz/shared'

export type { WorkflowGroup }

function mapTierGroups(groups: WorkflowGroup[]): WorkflowGroup[] {
  return groups.map((group) => ({
    key: group.key,
    title: group.title,
    items: group.items,
  }))
}

const UNCATEGORIZED_TITLE = 'Uncategorized'
export const RECENT_GROUP_KEY = 'recent'

export function buildWorkflowComboboxGroups(
  items: WorkflowSummary[],
  categoryOrder: string[],
  recentWorkflowNames: string[] = [],
  surfacePrefs?: WorkflowPickerSurfacePrefs,
  query?: string,
  groupTitles?: Parameters<typeof buildTierAwareWorkflowGroups>[0]['groupTitles'],
  includeBrowseLibraryTrigger?: boolean,
): WorkflowGroup[] {
  if (surfacePrefs) {
    return mapTierGroups(
      buildTierAwareWorkflowGroups({
        workflows: items,
        prefs: surfacePrefs,
        recentWorkflowNames,
        query,
        groupTitles,
        includeBrowseLibraryTrigger,
      }),
    )
  }

  const groups: WorkflowGroup[] = []
  const bySource = {
    project: items.filter((w) => w.source === 'project'),
    user: items.filter((w) => w.source === 'user'),
    builtin: items.filter((w) => w.source === 'builtin'),
    path: items.filter((w) => w.source === 'path'),
  }

  if (bySource.project.length > 0) {
    groups.push({ key: 'project', title: 'Project', items: bySource.project })
  }
  if (bySource.user.length > 0) {
    groups.push({ key: 'user', title: 'User', items: bySource.user })
  }

  const builtinByCategory = new Map<string, WorkflowSummary[]>()
  for (const category of categoryOrder) builtinByCategory.set(category, [])
  builtinByCategory.set(UNCATEGORIZED_TITLE, [])
  for (const workflow of bySource.builtin) {
    const categories = workflow.categories ?? []
    if (categories.length === 0) {
      builtinByCategory.get(UNCATEGORIZED_TITLE)?.push(workflow)
      continue
    }
    for (const category of categories) {
      if (!builtinByCategory.has(category)) builtinByCategory.set(category, [])
      builtinByCategory.get(category)?.push(workflow)
    }
  }
  const seen = new Set<string>()
  for (const category of categoryOrder) {
    seen.add(category)
    const groupItems = builtinByCategory.get(category) ?? []
    if (groupItems.length > 0) {
      groups.push({ key: `builtin:${category}`, title: category, items: groupItems })
    }
  }
  for (const [title, groupItems] of builtinByCategory) {
    if (title === UNCATEGORIZED_TITLE || seen.has(title)) continue
    if (groupItems.length > 0) {
      groups.push({ key: `builtin:${title}`, title, items: groupItems })
    }
  }
  const uncat = builtinByCategory.get(UNCATEGORIZED_TITLE) ?? []
  if (uncat.length > 0) {
    groups.push({ key: 'builtin:uncategorized', title: UNCATEGORIZED_TITLE, items: uncat })
  }

  if (bySource.path.length > 0) {
    groups.push({ key: 'path', title: 'Path', items: bySource.path })
  }

  const recentItems = resolveRecentWorkflowItems(items, recentWorkflowNames)
  if (recentItems.length > 0) {
    groups.unshift({ key: RECENT_GROUP_KEY, title: 'Recent', items: recentItems })
  }
  return groups
}

export function isWorkflowGroupExpanded(
  group: WorkflowGroup,
  isSearching: boolean,
  expandedGroups: Set<string>,
  selectedGroupKey: string | null,
): boolean {
  if (group.key === RECENT_GROUP_KEY) return true
  return isSearching || expandedGroups.has(group.key) || group.key === selectedGroupKey
}

/** Flatten expanded groups; first occurrence of each workflow name wins (keyboard nav). */
export function collectVisibleWorkflowItems(
  groups: WorkflowGroup[],
  isSearching: boolean,
  expandedGroups: Set<string>,
  selectedGroupKey: string | null,
): WorkflowSummary[] {
  const out: WorkflowSummary[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    if (!isWorkflowGroupExpanded(group, isSearching, expandedGroups, selectedGroupKey)) continue
    for (const wf of group.items) {
      if (seen.has(wf.name)) continue
      seen.add(wf.name)
      out.push(wf)
    }
  }
  return out
}
