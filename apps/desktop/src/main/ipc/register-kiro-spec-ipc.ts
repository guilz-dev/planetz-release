import { IPC_CHANNELS, kiroSpecGetInputSchema, parseIpcInput } from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerKiroSpecIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.kiroSpecList, async () => {
    return ctx.session.listKiroSpecs()
  })

  registerHandler(ctx, IPC_CHANNELS.kiroSpecGet, async (_event, raw) => {
    const input = parseIpcInput(kiroSpecGetInputSchema, raw, IPC_CHANNELS.kiroSpecGet)
    return ctx.session.getKiroSpec(input)
  })
}
