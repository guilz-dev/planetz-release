import { beforeEach, describe, expect, it, vi } from 'vitest'

const notificationMocks = vi.hoisted(() => {
  const instances: Array<{
    show: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    clickHandler: (() => void) | null
    options: { title: string; body: string }
  }> = []

  class MockNotification {
    show = vi.fn()
    on = vi.fn((event: string, handler: () => void) => {
      if (event === 'click') {
        this.clickHandler = handler
      }
    })
    clickHandler: (() => void) | null = null

    constructor(public options: { title: string; body: string }) {
      instances.push(this)
    }
  }

  return {
    instances,
    MockNotification,
    isSupported: vi.fn(() => true),
  }
})

vi.mock('electron', () => ({
  Notification: Object.assign(notificationMocks.MockNotification, {
    isSupported: notificationMocks.isSupported,
  }),
}))

import { TaskFailureDesktopNotifier } from '../lib/task-failure-desktop-notifier.js'

describe('TaskFailureDesktopNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationMocks.instances.length = 0
    notificationMocks.isSupported.mockReturnValue(true)
  })

  it('creates a notification and invokes click handler with task id', () => {
    const onClick = vi.fn()
    const notifier = new TaskFailureDesktopNotifier(onClick)

    notifier.notify({
      taskId: 'task-42',
      title: 'My task',
      message: 'Workflow aborted',
    })

    expect(notificationMocks.instances).toHaveLength(1)
    const instance = notificationMocks.instances[0]
    expect(instance?.options.body).toContain('My task')
    expect(instance?.show).toHaveBeenCalledOnce()

    instance?.clickHandler?.()
    expect(onClick).toHaveBeenCalledWith('task-42')
  })

  it('skips notification when not supported', () => {
    notificationMocks.isSupported.mockReturnValue(false)
    const onClick = vi.fn()
    const notifier = new TaskFailureDesktopNotifier(onClick)

    notifier.notify({ taskId: 't1', title: 'T', message: 'M' })

    expect(notificationMocks.instances).toHaveLength(0)
    expect(onClick).not.toHaveBeenCalled()
  })
})
