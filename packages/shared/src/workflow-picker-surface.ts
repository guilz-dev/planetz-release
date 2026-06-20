import {
  type BuiltinWorkflowTierMeta,
  getBuiltinWorkflowTierMeta,
  isCoreBuiltinWorkflow,
  isLibraryBuiltinWorkflow,
  isSystemTierBuiltinWorkflow,
  LIBRARY_PACKS,
} from './builtin-workflow-tier.js'
import { filterWorkflowSummaries } from './filter-workflow-summaries.js'
import type { WorkflowSummary } from './types.js'
import type { WorkflowLibraryUiPrefs } from './workflow-library-ui.js'
import { resolvePickerVisibleLibraryNames } from './workflow-library-visibility.js'
import { compareWorkflowLifecycleSort } from './workflow-surface/lifecycle-sort.js'
import { filterUserVisibleWorkflows } from './workflow-user-visibility.js'

export { isLibraryBuiltinWorkflow } from './builtin-workflow-tier.js'

export const BROWSE_LIBRARY_ACTION_NAME = '__planetz_browse_library__'
export const BROWSE_LIBRARY_GROUP_KEY = 'browse-library'
export const CORE_GROUP_KEY = 'core'
export const ENABLED_LIBRARY_GROUP_KEY = 'enabled-library'
export const CALL_TARGET_LIBRARY_GROUP_KEY = 'library-call-target'

export type WorkflowPickerSurfacePrefs = {
  workflowLibrary: WorkflowLibraryUiPrefs
  pinnedWorkflows: string[]
  hiddenCoreWorkflows: string[]
}

export interface WorkflowGroup {
  key: string
  title: string
  items: WorkflowSummary[]
}

type LibrarySurfaceMode = 'enabled-only' | 'all-call-targets'

const BROWSE_LIBRARY_PSEUDO_SOURCE = 'builtin' as const

function browseLibraryPseudoItem(): WorkflowSummary {
  return {
    name: BROWSE_LIBRARY_ACTION_NAME,
    source: BROWSE_LIBRARY_PSEUDO_SOURCE,
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
    description: 'Browse all library packs',
  }
}

export function isBrowseLibraryAction(name: string): boolean {
  return name === BROWSE_LIBRARY_ACTION_NAME
}

export function resolveRecentWorkflowItems(
  items: WorkflowSummary[],
  recentWorkflowNames: string[],
): WorkflowSummary[] {
  if (recentWorkflowNames.length === 0) return []
  const byName = new Map(items.map((w) => [w.name, w]))
  const recent: WorkflowSummary[] = []
  for (const name of recentWorkflowNames) {
    const wf = byName.get(name)
    if (wf) recent.push(wf)
  }
  return recent
}

export function orderCoreBuiltinWorkflows(
  items: WorkflowSummary[],
  prefs: Pick<WorkflowPickerSurfacePrefs, 'pinnedWorkflows'>,
): WorkflowSummary[] {
  const pinned = new Set(prefs.pinnedWorkflows)
  return [...items].sort((a, b) => {
    const aPinned = pinned.has(a.name)
    const bPinned = pinned.has(b.name)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    const aRank = getBuiltinWorkflowTierMeta(a.name).displayRank ?? Number.MAX_SAFE_INTEGER
    const bRank = getBuiltinWorkflowTierMeta(b.name).displayRank ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return a.name.localeCompare(b.name)
  })
}

/** Picker surface: omit hidden core workflows, then apply pin/rank ordering. */
export function sortCoreBuiltinWorkflows(
  items: WorkflowSummary[],
  prefs: WorkflowPickerSurfacePrefs,
): WorkflowSummary[] {
  const hidden = new Set(prefs.hiddenCoreWorkflows)
  const visible = items.filter((w) => !hidden.has(w.name))
  return orderCoreBuiltinWorkflows(visible, prefs)
}

export function workflowPickerSurfacePrefsFromUi(ui: {
  workflowLibrary?: WorkflowLibraryUiPrefs
  pinnedWorkflows?: string[]
  hiddenCoreWorkflows?: string[]
}): WorkflowPickerSurfacePrefs {
  return {
    workflowLibrary: ui.workflowLibrary ?? {
      enabledPacks: [],
      enabledWorkflows: [],
      autoEnabledWorkflows: [],
      implicitEnabledWorkflows: [],
      dismissedImplicitWorkflows: [],
    },
    pinnedWorkflows: ui.pinnedWorkflows ?? [],
    hiddenCoreWorkflows: ui.hiddenCoreWorkflows ?? [],
  }
}

function partitionNonBuiltinSources(workflows: WorkflowSummary[]) {
  return {
    project: workflows.filter((w) => w.source === 'project'),
    user: workflows.filter((w) => w.source === 'user'),
    path: workflows.filter((w) => w.source === 'path'),
  }
}

function omitSystemBuiltins(workflows: WorkflowSummary[]): WorkflowSummary[] {
  return filterUserVisibleWorkflows(workflows)
}

function resolveLibraryItems(
  workflows: WorkflowSummary[],
  mode: LibrarySurfaceMode,
  prefs: WorkflowPickerSurfacePrefs,
): WorkflowSummary[] {
  const libraryBuiltins = workflows.filter(
    (w) => w.source === 'builtin' && isLibraryBuiltinWorkflow(w.name),
  )
  if (mode === 'all-call-targets') {
    return [...libraryBuiltins].sort(compareWorkflowLifecycleSort)
  }
  const enabledLibraryNames = new Set(
    resolvePickerVisibleLibraryNames(workflows, prefs.workflowLibrary),
  )
  return libraryBuiltins.filter((w) => enabledLibraryNames.has(w.name))
}

function buildSearchWorkflowGroups(
  workflows: WorkflowSummary[],
  titles: { project: string; user: string; path: string; builtin?: string },
): WorkflowGroup[] {
  const groups: WorkflowGroup[] = []
  const bySource = {
    project: workflows.filter((w) => w.source === 'project'),
    user: workflows.filter((w) => w.source === 'user'),
    builtin: workflows.filter((w) => w.source === 'builtin'),
    path: workflows.filter((w) => w.source === 'path'),
  }
  if (bySource.project.length > 0) {
    groups.push({ key: 'project', title: titles.project, items: bySource.project })
  }
  if (bySource.user.length > 0) {
    groups.push({ key: 'user', title: titles.user, items: bySource.user })
  }
  if (bySource.builtin.length > 0) {
    groups.push({
      key: 'builtin-search',
      title: titles.builtin ?? 'Builtin',
      items: bySource.builtin,
    })
  }
  if (bySource.path.length > 0) {
    groups.push({ key: 'path', title: titles.path, items: bySource.path })
  }
  return groups
}

function isEligibleCallTargetBuiltin(name: string, preserveName?: string): boolean {
  if (isSystemTierBuiltinWorkflow(name)) {
    return preserveName === name
  }
  const tier = getBuiltinWorkflowTierMeta(name).tier
  return tier === 'core' || tier === 'library'
}

export function buildWorkflowCallTargetGroups(input: {
  workflows: WorkflowSummary[]
  query?: string
  /** Retain system-tier name when editing an orphan reference. */
  preserveSelectedName?: string
  groupTitles?: Partial<{
    project: string
    user: string
    core: string
    library: string
    path: string
    preservedSystem: string
  }>
}): WorkflowGroup[] {
  const titles = {
    project: 'Project',
    user: 'User',
    core: 'Core',
    library: 'Library',
    path: 'Path',
    preservedSystem: 'System (legacy reference)',
    ...input.groupTitles,
  }
  const preserve = input.preserveSelectedName?.trim()
  const visible = filterUserVisibleWorkflows(input.workflows, {
    preserveSelectedName: preserve,
  })
  const eligible = visible.filter((workflow) => {
    if (workflow.source !== 'builtin') return true
    return isEligibleCallTargetBuiltin(workflow.name, preserve)
  })

  const query = input.query?.trim() ?? ''
  const tierMeta = tierMetaByWorkflowName(eligible)
  const filtered = query.length > 0 ? filterWorkflowSummaries(query, eligible, tierMeta) : eligible

  if (query.length > 0) {
    return buildSearchWorkflowGroups(filtered, titles)
  }

  const groups: WorkflowGroup[] = []
  const bySource = partitionNonBuiltinSources(filtered)

  if (bySource.project.length > 0) {
    groups.push({ key: 'project', title: titles.project, items: bySource.project })
  }
  if (bySource.user.length > 0) {
    groups.push({ key: 'user', title: titles.user, items: bySource.user })
  }

  const coreItems = [...filtered]
    .filter((w) => w.source === 'builtin' && isCoreBuiltinWorkflow(w.name))
    .sort((a, b) => {
      const aRank = getBuiltinWorkflowTierMeta(a.name).displayRank ?? Number.MAX_SAFE_INTEGER
      const bRank = getBuiltinWorkflowTierMeta(b.name).displayRank ?? Number.MAX_SAFE_INTEGER
      if (aRank !== bRank) return aRank - bRank
      return a.name.localeCompare(b.name)
    })
  if (coreItems.length > 0) {
    groups.push({ key: CORE_GROUP_KEY, title: titles.core, items: coreItems })
  }

  const libraryItems = [...filtered]
    .filter((w) => w.source === 'builtin' && isLibraryBuiltinWorkflow(w.name))
    .sort(compareWorkflowLifecycleSort)
  if (libraryItems.length > 0) {
    groups.push({ key: CALL_TARGET_LIBRARY_GROUP_KEY, title: titles.library, items: libraryItems })
  }

  if (bySource.path.length > 0) {
    groups.push({ key: 'path', title: titles.path, items: bySource.path })
  }

  if (preserve) {
    const placed = new Set(groups.flatMap((group) => group.items.map((item) => item.name)))
    const preservedOrphans = visible.filter(
      (workflow) =>
        workflow.name === preserve &&
        !placed.has(workflow.name) &&
        isSystemTierBuiltinWorkflow(workflow.name),
    )
    if (preservedOrphans.length > 0) {
      groups.unshift({
        key: 'preserved-system',
        title: titles.preservedSystem,
        items: preservedOrphans,
      })
    }
  }

  return groups
}

export function buildTierAwareWorkflowGroups(input: {
  workflows: WorkflowSummary[]
  prefs: WorkflowPickerSurfacePrefs
  recentWorkflowNames?: string[]
  query?: string
  /** When false, omits the Browse Library pseudo row (inline combobox). */
  includeBrowseLibraryTrigger?: boolean
  groupTitles?: Partial<{
    project: string
    user: string
    recent: string
    core: string
    enabledLibrary: string
    browseLibrary: string
    path: string
  }>
}): WorkflowGroup[] {
  const query = input.query?.trim() ?? ''
  const isSearching = query.length > 0
  const visibleWorkflows = omitSystemBuiltins(input.workflows)
  const titles = {
    project: 'Project',
    user: 'User',
    recent: 'Recent',
    core: 'Core',
    enabledLibrary: 'Library',
    browseLibrary: 'Browse Library…',
    path: 'Path',
    ...input.groupTitles,
  }

  if (isSearching) {
    const tierMeta = tierMetaByWorkflowName(visibleWorkflows)
    const filtered = filterWorkflowSummaries(query, visibleWorkflows, tierMeta)
    return buildSearchWorkflowGroups(filtered, titles)
  }

  const groups: WorkflowGroup[] = []
  const bySource = partitionNonBuiltinSources(visibleWorkflows)

  if (bySource.project.length > 0) {
    groups.push({ key: 'project', title: titles.project, items: bySource.project })
  }
  if (bySource.user.length > 0) {
    groups.push({ key: 'user', title: titles.user, items: bySource.user })
  }

  const recentItems = resolveRecentWorkflowItems(visibleWorkflows, input.recentWorkflowNames ?? [])
  if (recentItems.length > 0) {
    groups.push({ key: 'recent', title: titles.recent, items: recentItems })
  }

  const coreItems = sortCoreBuiltinWorkflows(
    visibleWorkflows.filter((w) => w.source === 'builtin' && isCoreBuiltinWorkflow(w.name)),
    input.prefs,
  )
  if (coreItems.length > 0) {
    groups.push({ key: CORE_GROUP_KEY, title: titles.core, items: coreItems })
  }

  const enabledLibraryItems = resolveLibraryItems(visibleWorkflows, 'enabled-only', input.prefs)
  if (enabledLibraryItems.length > 0) {
    groups.push({
      key: ENABLED_LIBRARY_GROUP_KEY,
      title: titles.enabledLibrary,
      items: enabledLibraryItems,
    })
  }

  if (input.includeBrowseLibraryTrigger !== false) {
    groups.push({
      key: BROWSE_LIBRARY_GROUP_KEY,
      title: titles.browseLibrary,
      items: [browseLibraryPseudoItem()],
    })
  }

  if (bySource.path.length > 0) {
    groups.push({ key: 'path', title: titles.path, items: bySource.path })
  }

  return groups
}

export function listLibraryPackBrowseGroups(input: {
  workflows: WorkflowSummary[]
  prefs: WorkflowPickerSurfacePrefs
}): Array<{ packId: string; title: string; items: WorkflowSummary[] }> {
  const groups: Array<{ packId: string; title: string; items: WorkflowSummary[] }> = []
  for (const pack of LIBRARY_PACKS) {
    const items: WorkflowSummary[] = []
    for (const workflow of input.workflows) {
      if (workflow.source !== 'builtin') continue
      const meta = getBuiltinWorkflowTierMeta(workflow.name)
      if (meta.packId !== pack.id) continue
      items.push(workflow)
    }
    if (items.length === 0) continue
    items.sort(compareWorkflowLifecycleSort)
    groups.push({
      packId: pack.id,
      title: pack.tierReason,
      items,
    })
  }
  return groups
}

export function tierMetaByWorkflowName(
  workflows: ReadonlyArray<Pick<WorkflowSummary, 'name' | 'source'>>,
): Map<string, BuiltinWorkflowTierMeta> {
  const map = new Map<string, BuiltinWorkflowTierMeta>()
  for (const workflow of workflows) {
    if (workflow.source !== 'builtin') continue
    map.set(workflow.name, getBuiltinWorkflowTierMeta(workflow.name))
  }
  return map
}
