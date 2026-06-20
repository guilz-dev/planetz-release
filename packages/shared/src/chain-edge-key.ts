import type { ChainEdge } from './types.js'

/** Sentinel for pending edges without `toTaskId` (IPC delete / status). */
export const CHAIN_EDGE_PENDING_TO = '__pending__'

export function chainEdgeKey(edge: Pick<ChainEdge, 'fromTaskId' | 'toTaskId'>): string {
  return `${edge.fromTaskId}->${edge.toTaskId ?? CHAIN_EDGE_PENDING_TO}`
}

export function parseChainEdgeKey(edgeKey: string): { fromTaskId: string; toTaskId?: string } {
  const [fromTaskId, rawTo] = edgeKey.split('->')
  if (!fromTaskId || rawTo === undefined) {
    throw new Error(`Invalid chain edge key: ${edgeKey}`)
  }
  return {
    fromTaskId,
    toTaskId: rawTo === CHAIN_EDGE_PENDING_TO ? undefined : rawTo,
  }
}
