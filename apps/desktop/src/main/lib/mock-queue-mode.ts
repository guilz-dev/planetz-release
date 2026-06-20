import type { WorkspaceBootstrapStatus } from '@planetz/shared'

/** When true, task/agent state is served from the mock queue instead of takt projection. */
export function isMockQueueMode(input: {
  envMockEnabled: boolean
  workspacePath: string | null
  bootstrapOverride: WorkspaceBootstrapStatus | null
}): boolean {
  if (input.envMockEnabled) return true
  if (!input.workspacePath) return true
  if (input.bootstrapOverride) return input.bootstrapOverride !== 'takt_ready'
  return false
}
