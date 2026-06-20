import { describe, expect, it } from 'vitest'
import { withTasksYamlLock } from '../lib/tasks-yaml-lock.js'

describe('withTasksYamlLock', () => {
  it('runs tasks for the same key sequentially', async () => {
    const order: number[] = []
    const key = `lock-test-${Date.now()}`

    const first = withTasksYamlLock(key, async () => {
      order.push(1)
      await delay(20)
      order.push(2)
    })
    const second = withTasksYamlLock(key, async () => {
      order.push(3)
    })

    await Promise.all([first, second])
    expect(order).toEqual([1, 2, 3])
  })
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
