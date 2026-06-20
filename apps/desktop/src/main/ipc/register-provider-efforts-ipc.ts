import {
  deleteEffortHistoryItemInputSchema,
  IPC_CHANNELS,
  listEffortHistoryInputSchema,
  listProviderEffortsInputSchema,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerProviderEffortsIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.providerEffortsList, async (_event, raw) => {
    const input = parseIpcInput(
      listProviderEffortsInputSchema,
      raw,
      IPC_CHANNELS.providerEffortsList,
    )
    return ctx.session.listProviderEfforts(input)
  })

  registerHandler(ctx, IPC_CHANNELS.effortHistoryList, async (_event, raw) => {
    const input = parseIpcInput(listEffortHistoryInputSchema, raw, IPC_CHANNELS.effortHistoryList)
    const items = await ctx.session.listEffortHistory(input?.provider)
    return { items }
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.effortHistoryDelete,
    deleteEffortHistoryItemInputSchema,
    async (input) => {
      await ctx.session.deleteEffortHistoryItem(input)
      return { ok: true as const }
    },
  )
}
