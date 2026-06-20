import { chatComposerDraftSaveInputSchema, IPC_CHANNELS, parseIpcInput } from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerChatComposerDraftIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.chatComposerDraftGet, async () => {
    return ctx.session.getChatComposerDraft()
  })

  registerHandler(ctx, IPC_CHANNELS.chatComposerDraftSave, async (_event, raw) => {
    const input = parseIpcInput(
      chatComposerDraftSaveInputSchema,
      raw,
      IPC_CHANNELS.chatComposerDraftSave,
    )
    return ctx.session.saveChatComposerDraft(input)
  })
}
