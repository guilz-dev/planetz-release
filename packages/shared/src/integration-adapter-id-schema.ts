import { z } from 'zod'

/** Integration hook / settings adapter ids (single source for IPC and sidecar schemas). */
export const integrationAdapterIdSchema = z.enum(['cursor', 'codex', 'claude'])
