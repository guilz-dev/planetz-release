import type { DecidedIntent } from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

/** Read-only access to the current decided intent for a Spec Thread. */
export interface DecidedIntentReadPort {
  getCurrent(paths: SidecarPaths, threadId: string): Promise<DecidedIntent | null>
}
