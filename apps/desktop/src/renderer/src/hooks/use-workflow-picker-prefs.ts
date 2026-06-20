import { useWorkflowLibraryPrefs } from './use-workflow-library-prefs.js'

export function useWorkflowPickerPrefs(enabled = true) {
  const library = useWorkflowLibraryPrefs(enabled)
  return {
    prefs: library.prefs,
    refresh: library.refresh,
    enableWorkflowInWorkspace: library.enableWorkflowInWorkspace,
    enablePackInWorkspace: library.enablePackInWorkspace,
    dismissImplicitWorkflow: library.dismissImplicitWorkflow,
  }
}
