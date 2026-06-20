/** Workspace UI prefs for builtin library surfacing (picker + auto opt-in). */
export type WorkflowLibraryUiPrefs = {
  enabledPacks: string[]
  enabledWorkflows: string[]
  autoEnabledWorkflows: string[]
  implicitEnabledWorkflows: string[]
  dismissedImplicitWorkflows: string[]
}

export const EMPTY_WORKFLOW_LIBRARY_PREFS: WorkflowLibraryUiPrefs = {
  enabledPacks: [],
  enabledWorkflows: [],
  autoEnabledWorkflows: [],
  implicitEnabledWorkflows: [],
  dismissedImplicitWorkflows: [],
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export function normalizeWorkflowLibraryUiPrefs(raw: unknown): WorkflowLibraryUiPrefs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...EMPTY_WORKFLOW_LIBRARY_PREFS }
  }
  const record = raw as Record<string, unknown>
  return {
    enabledPacks: normalizeStringList(record.enabledPacks),
    enabledWorkflows: normalizeStringList(record.enabledWorkflows),
    autoEnabledWorkflows: normalizeStringList(record.autoEnabledWorkflows),
    implicitEnabledWorkflows: normalizeStringList(record.implicitEnabledWorkflows),
    dismissedImplicitWorkflows: normalizeStringList(record.dismissedImplicitWorkflows),
  }
}

export function mergeWorkflowLibraryUiPrefs(
  current: WorkflowLibraryUiPrefs,
  patch: Partial<WorkflowLibraryUiPrefs>,
): WorkflowLibraryUiPrefs {
  return {
    enabledPacks: patch.enabledPacks ?? current.enabledPacks,
    enabledWorkflows: patch.enabledWorkflows ?? current.enabledWorkflows,
    autoEnabledWorkflows: patch.autoEnabledWorkflows ?? current.autoEnabledWorkflows,
    implicitEnabledWorkflows: patch.implicitEnabledWorkflows ?? current.implicitEnabledWorkflows,
    dismissedImplicitWorkflows:
      patch.dismissedImplicitWorkflows ?? current.dismissedImplicitWorkflows,
  }
}
