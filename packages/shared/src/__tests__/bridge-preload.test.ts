import { describe, expect, it, vi } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { buildBridgeInvokeMethods } from '../bridge-preload.js'

describe('buildBridgeInvokeMethods', () => {
  it('wires all manifest invoke methods', () => {
    const invoke = vi.fn(async () => undefined)
    const methods = buildBridgeInvokeMethods(invoke)
    expect(new Set(Object.keys(methods))).toEqual(
      new Set(BRIDGE_INVOKE_MANIFEST.map((entry) => entry.method)),
    )
  })

  it('maps each argStyle to expected invoke payload', async () => {
    const invoke = vi.fn(async () => undefined)
    const methods = buildBridgeInvokeMethods(invoke)

    const noneEntry = BRIDGE_INVOKE_MANIFEST.find((entry) => entry.argStyle === 'none')
    const inputEntry = BRIDGE_INVOKE_MANIFEST.find((entry) => entry.argStyle === 'input')
    const optionalInputEntry = BRIDGE_INVOKE_MANIFEST.find(
      (entry) => entry.argStyle === 'optionalInput',
    )
    const bootstrapEntry = BRIDGE_INVOKE_MANIFEST.find(
      (entry) => entry.argStyle === 'bootstrapStatus',
    )
    const chainBranchEntry = BRIDGE_INVOKE_MANIFEST.find(
      (entry) => entry.argStyle === 'chainBranch',
    )
    const selectTaskIdEntry = BRIDGE_INVOKE_MANIFEST.find(
      (entry) => entry.argStyle === 'selectTaskId',
    )

    expect(noneEntry).toBeDefined()
    expect(inputEntry).toBeDefined()
    expect(optionalInputEntry).toBeDefined()
    expect(bootstrapEntry).toBeDefined()
    expect(chainBranchEntry).toBeDefined()
    expect(selectTaskIdEntry).toBeDefined()

    await methods[noneEntry?.method as string]()
    await methods[inputEntry?.method as string]({ sample: 1 })
    await methods[optionalInputEntry?.method as string]()
    await methods[bootstrapEntry?.method as string]('non_takt')
    await methods[chainBranchEntry?.method as string]('feature/123')
    await methods[selectTaskIdEntry?.method as string]('task-1')

    expect(invoke).toHaveBeenNthCalledWith(1, noneEntry?.channel)
    expect(invoke).toHaveBeenNthCalledWith(2, inputEntry?.channel, { sample: 1 })
    expect(invoke).toHaveBeenNthCalledWith(3, optionalInputEntry?.channel, {})
    expect(invoke).toHaveBeenNthCalledWith(4, bootstrapEntry?.channel, { status: 'non_takt' })
    expect(invoke).toHaveBeenNthCalledWith(5, chainBranchEntry?.channel, { branch: 'feature/123' })
    expect(invoke).toHaveBeenNthCalledWith(6, selectTaskIdEntry?.channel, { taskId: 'task-1' })
  })
})
