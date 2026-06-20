import type { AppState } from '@planetz/shared'

/** Clears task/agent projection while keeping workspace chrome for in-place loading. */
export function clearTaskProjection(state: AppState): AppState {
  return {
    ...state,
    agents: [],
    executors: [],
    tasks: [],
    retries: [],
    results: [],
    chains: [],
    selectedTaskId: undefined,
  }
}
