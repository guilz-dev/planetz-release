import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { recordChatToTaskMetric } from '../chat-to-task-metrics.js'

describe('recordChatToTaskMetric', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops when the preload bridge method is missing', () => {
    vi.stubGlobal('window', { orbit: {} })
    expect(() => recordChatToTaskMetric('chat_add_to_task_click')).not.toThrow()
  })

  it('invokes the bridge with the event payload', () => {
    const recordChatToTaskMetricBridge = vi.fn(async () => {})
    installOrbitMock({ recordChatToTaskMetric: recordChatToTaskMetricBridge })
    recordChatToTaskMetric('chat_to_task_conflict_replace')
    expect(recordChatToTaskMetricBridge).toHaveBeenCalledWith({
      event: 'chat_to_task_conflict_replace',
    })
  })

  it('swallows bridge rejection without throwing', () => {
    const recordChatToTaskMetricBridge = vi.fn(async () => {
      throw new Error('ipc failed')
    })
    installOrbitMock({ recordChatToTaskMetric: recordChatToTaskMetricBridge })
    expect(() => recordChatToTaskMetric('chat_add_to_task_click')).not.toThrow()
  })
})
