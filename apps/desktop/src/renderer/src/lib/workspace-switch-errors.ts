export const WORKSPACE_NOT_FOUND_PREFIX = 'Workspace not found'

export function isWorkspaceNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(WORKSPACE_NOT_FOUND_PREFIX)
}
