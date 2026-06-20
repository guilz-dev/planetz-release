import {
  chatMcpGrantConsentInputSchema,
  chatMcpPendingConsentResultSchema,
  chatMcpServersOverviewResultSchema,
  chatMcpSetSecretInputSchema,
  chatMcpSetSecretResultSchema,
  IPC_CHANNELS,
  parseIpcInput,
  parseIpcOutput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerChatMcpIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.chatMcpListPendingConsent, async () => {
    const serverIds = await ctx.session.listChatMcpPendingConsent()
    return parseIpcOutput(
      chatMcpPendingConsentResultSchema,
      { serverIds },
      IPC_CHANNELS.chatMcpListPendingConsent,
    )
  })

  registerHandler(ctx, IPC_CHANNELS.chatMcpGrantConsent, async (_event, raw) => {
    const input = parseIpcInput(
      chatMcpGrantConsentInputSchema,
      raw,
      IPC_CHANNELS.chatMcpGrantConsent,
    )
    if (!input) throw new Error('Invalid MCP consent input')
    await ctx.session.grantChatMcpConsent(input.serverId)
  })

  registerHandler(ctx, IPC_CHANNELS.chatMcpListServersOverview, async () => {
    const result = await ctx.session.listChatMcpServersOverview()
    return parseIpcOutput(
      chatMcpServersOverviewResultSchema,
      result,
      IPC_CHANNELS.chatMcpListServersOverview,
    )
  })

  registerHandler(ctx, IPC_CHANNELS.chatMcpSetSecret, async (_event, raw) => {
    const input = parseIpcInput(chatMcpSetSecretInputSchema, raw, IPC_CHANNELS.chatMcpSetSecret)
    if (!input) throw new Error('Invalid MCP secret input')
    const result = await ctx.session.setChatMcpSecret(input.secretName, input.secretValue)
    return parseIpcOutput(chatMcpSetSecretResultSchema, result, IPC_CHANNELS.chatMcpSetSecret)
  })
}
