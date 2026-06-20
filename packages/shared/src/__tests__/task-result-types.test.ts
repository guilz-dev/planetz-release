import { describe, expect, it } from 'vitest'
import { parseIpcOutput } from '../ipc-schemas.js'
import { taskResultBundleSchema } from '../task-result-types.js'

describe('taskResultBundleSchema', () => {
  it('accepts a minimal no_run bundle', () => {
    const parsed = taskResultBundleSchema.safeParse({
      taskId: 't1',
      runsDirRel: '.takt/runs',
      reports: [],
      status: 'no_run',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects unknown status values', () => {
    const parsed = taskResultBundleSchema.safeParse({
      taskId: 't1',
      reports: [],
      status: 'invalid',
    })
    expect(parsed.success).toBe(false)
  })

  it('parseIpcOutput throws on invalid handler return', () => {
    expect(() =>
      parseIpcOutput(
        taskResultBundleSchema,
        { taskId: '', reports: [], status: 'ok' },
        'task:getResult',
      ),
    ).toThrow(/task:getResult/)
  })
})
