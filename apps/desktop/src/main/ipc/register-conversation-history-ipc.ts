import {
  conversationHistoryDeleteInputSchema,
  conversationHistoryGetInputSchema,
  conversationHistoryListInputSchema,
  conversationHistorySearchInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerConversationHistoryIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.conversationHistoryList, async (_event, raw) => {
    const input = parseIpcInput(
      conversationHistoryListInputSchema,
      raw,
      IPC_CHANNELS.conversationHistoryList,
    )
    return ctx.session.listConversationHistory(input)
  })

  registerHandler(ctx, IPC_CHANNELS.conversationHistoryGet, async (_event, raw) => {
    const input = parseIpcInput(
      conversationHistoryGetInputSchema,
      raw,
      IPC_CHANNELS.conversationHistoryGet,
    )
    return ctx.session.getConversationHistory(input)
  })

  registerHandler(ctx, IPC_CHANNELS.conversationHistoryDelete, async (_event, raw) => {
    const input = parseIpcInput(
      conversationHistoryDeleteInputSchema,
      raw,
      IPC_CHANNELS.conversationHistoryDelete,
    )
    return ctx.session.deleteConversationHistory(input)
  })

  registerHandler(ctx, IPC_CHANNELS.conversationHistorySearch, async (_event, raw) => {
    const input = parseIpcInput(
      conversationHistorySearchInputSchema,
      raw,
      IPC_CHANNELS.conversationHistorySearch,
    )
    return ctx.session.searchConversationHistory(input)
  })
}
