import {
  DECISIONS_EXPENSIVE_ONLY_STORAGE_KEY,
  RECENT_WORKFLOWS_STORAGE_KEY,
  useAppStore,
} from '../store/app-store.js'

/** Reset renderer app store between hook tests. */
export function resetAppStore(): void {
  try {
    window.localStorage.removeItem(RECENT_WORKFLOWS_STORAGE_KEY)
    window.localStorage.removeItem(DECISIONS_EXPENSIVE_ONLY_STORAGE_KEY)
  } catch {
    // ignore
  }
  useAppStore.setState({
    state: null,
    workspaceSwitching: false,
    promptHistory: [],
    recentWorkflowNames: [],
    executionLogPreset: null,
    decisionsExpensiveOnly: true,
    decisionsFilterTaskId: null,
    executorFilterByView: {},
    activeView: 'task',
    composerAssistHandoff: null,
    chatAssistHandoff: null,
    chatToTaskHandoff: null,
    chatHandoffError: null,
  })
}
