import type { ChainEdge, ChainPlannedTask } from './types.js'

export type ChainHandoffMode = ChainPlannedTask['mode']

/** Canonical mode: `planned.mode` while pending, then edge `mode` after materialize. */
export function resolveChainEdgeMode(edge: Pick<ChainEdge, 'mode' | 'planned'>): ChainHandoffMode {
  if (edge.planned?.mode) return edge.planned.mode
  if (edge.mode) return edge.mode
  return 'branch_handoff'
}
