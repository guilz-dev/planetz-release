import {
  BRIDGE_INVOKE_MANIFEST,
  type BridgeArgStyle,
  type BridgeInvokeSlice,
} from './bridge-manifest.js'

export type { BridgeInvokeSlice }

export type IpcRendererInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>

function invokeWithArgStyle(
  invoke: IpcRendererInvoke,
  channel: string,
  argStyle: BridgeArgStyle,
): (...args: unknown[]) => Promise<unknown> {
  switch (argStyle) {
    case 'none':
      return () => invoke(channel)
    case 'input':
      return (input: unknown) => invoke(channel, input)
    case 'optionalInput':
      return (input?: unknown) => invoke(channel, input ?? {})
    case 'bootstrapStatus':
      return (status: unknown) => invoke(channel, { status })
    case 'chainBranch':
      return (branch: unknown) => invoke(channel, { branch })
    case 'selectTaskId':
      return (taskId: unknown) => invoke(channel, { taskId })
    default: {
      const _exhaustive: never = argStyle
      return _exhaustive
    }
  }
}

/** Build invoke-backed bridge methods from the shared manifest. */
export function buildBridgeInvokeMethods(
  invoke: IpcRendererInvoke,
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const entry of BRIDGE_INVOKE_MANIFEST) {
    methods[entry.method] = invokeWithArgStyle(invoke, entry.channel, entry.argStyle)
  }
  return methods
}
