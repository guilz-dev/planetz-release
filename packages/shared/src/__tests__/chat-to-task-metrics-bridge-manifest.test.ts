import { describe, expect, it } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { IPC_CHANNELS } from '../ipc-channels.js'

describe('chat to task metrics bridge manifest', () => {
  it('wires recordChatToTaskMetric without broadcast', () => {
    const entry = BRIDGE_INVOKE_MANIFEST.find((item) => item.method === 'recordChatToTaskMetric')
    expect(entry?.channel).toBe(IPC_CHANNELS.chatToTaskMetricRecord)
    expect(entry?.broadcasts).toBe(false)
    expect(entry?.argStyle).toBe('input')
  })
})
