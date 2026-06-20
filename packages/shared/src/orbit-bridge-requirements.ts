import type { OrbitBridge } from './bridge-types.js'

/** Invoke methods required by execution analytics views (Log / Summary). */
export const EXECUTION_ANALYTICS_BRIDGE_METHODS = [
  'listExecutionLog',
  'getExecutionSummary',
  'getIntentLedgerSummary',
] as const satisfies readonly (keyof OrbitBridge)[]

export type ExecutionAnalyticsBridgeMethod = (typeof EXECUTION_ANALYTICS_BRIDGE_METHODS)[number]

/** Event methods required for live Chat composer token streaming. */
export const CHAT_COMPOSER_STREAM_BRIDGE_METHODS = [
  'onComposerSessionStream',
] as const satisfies readonly (keyof OrbitBridge)[]

export function missingOrbitMethods(
  orbit: OrbitBridge | undefined,
  required: readonly string[],
): string[] {
  if (!orbit) return [...required]
  const record = orbit as unknown as Record<string, unknown>
  return required.filter((m) => typeof record[m] !== 'function')
}
