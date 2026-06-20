import {
  deleteModelHistoryItemInputSchema,
  IPC_CHANNELS,
  listModelHistoryInputSchema,
  listProviderModelsInputSchema,
  parseIpcInput,
  rememberProviderModelSelectionInputSchema,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerProviderModelsIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.providerModelsList, async (_event, raw) => {
    const input = parseIpcInput(listProviderModelsInputSchema, raw, IPC_CHANNELS.providerModelsList)
    return ctx.session.listProviderModels(input)
  })

  registerHandler(ctx, IPC_CHANNELS.modelHistoryList, async (_event, raw) => {
    const input = parseIpcInput(listModelHistoryInputSchema, raw, IPC_CHANNELS.modelHistoryList)
    const items = await ctx.session.listModelHistory(input?.provider)
    return { items }
  })

  registerHandler(ctx, IPC_CHANNELS.providerModelSelectionRemember, async (_event, raw) => {
    const input = parseIpcInput(
      rememberProviderModelSelectionInputSchema,
      raw,
      IPC_CHANNELS.providerModelSelectionRemember,
    )
    await ctx.session.rememberProviderModelSelection(input)
    return { ok: true as const }
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.modelHistoryDelete,
    deleteModelHistoryItemInputSchema,
    async (input) => {
      await ctx.session.deleteModelHistoryItem(input)
      return { ok: true as const }
    },
  )
}
