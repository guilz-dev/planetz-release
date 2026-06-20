/** Thrown when `takt add` enqueue fails and package-writer fallback is disabled. */
export const TAKT_ADD_ENQUEUE_FAILED_CODE = 'TAKT_ADD_ENQUEUE_FAILED'

export class TaktAddEnqueueError extends Error {
  readonly code = TAKT_ADD_ENQUEUE_FAILED_CODE

  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message)
    this.name = 'TaktAddEnqueueError'
  }
}

export function formatTaktAddEnqueueFailureMessage(reason: string, detail?: string): string {
  const trimmedDetail = detail?.trim()
  const detailSuffix =
    trimmedDetail && trimmedDetail.length > 0 ? ` (${trimmedDetail.slice(0, 240)})` : ''
  return (
    `takt add enqueue failed: ${reason}${detailSuffix}. ` +
    'Tasks were not created without worktree metadata. ' +
    'Set PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK=1 to fall back to direct package enqueue, ' +
    'or PLANETZ_ENQUEUE_MODE=package_writer for intentional direct enqueue.'
  )
}
