import { describe, expect, it } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { IPC_CHANNELS } from '../ipc-channels.js'
import { EXECUTION_ANALYTICS_BRIDGE_METHODS } from '../orbit-bridge-requirements.js'

function manifestEntry(method: string) {
  return BRIDGE_INVOKE_MANIFEST.find((entry) => entry.method === method)
}

describe('execution analytics bridge manifest', () => {
  it('wires listExecutionLog to executionLog:list without broadcast', () => {
    const entry = manifestEntry('listExecutionLog')
    expect(entry?.channel).toBe(IPC_CHANNELS.executionLogList)
    expect(entry?.broadcasts).toBe(false)
  })

  it('wires getExecutionSummary to executionSummary:get without broadcast', () => {
    const entry = manifestEntry('getExecutionSummary')
    expect(entry?.channel).toBe(IPC_CHANNELS.executionSummaryGet)
    expect(entry?.broadcasts).toBe(false)
  })

  it('includes all execution analytics required methods', () => {
    const methods = new Set(BRIDGE_INVOKE_MANIFEST.map((entry) => entry.method))
    for (const method of EXECUTION_ANALYTICS_BRIDGE_METHODS) {
      expect(methods.has(method), `missing manifest entry for ${method}`).toBe(true)
    }
  })
})
