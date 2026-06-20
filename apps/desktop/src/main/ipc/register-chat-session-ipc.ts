import {
  chatSessionApplyChangesInputSchema,
  chatSessionApplyChangesResultSchema,
  chatSessionPendingChangeFileInputSchema,
  chatSessionPendingChangeFileResultSchema,
  chatSessionPendingChangesResultSchema,
  chatSessionThreadInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
  parseIpcOutput,
} from '@planetz/shared'
import {
  ChatSessionApplyMismatchError,
  ChatSessionApplyNotFoundError,
  ChatSessionApplyPolicyError,
} from '../session/chat-session-apply-errors.js'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

function rethrowApplyError(error: unknown): never {
  if (error instanceof ChatSessionApplyMismatchError) {
    const wrapped = new Error(error.message) as Error & { code?: string }
    wrapped.code = error.code
    throw wrapped
  }
  if (error instanceof ChatSessionApplyNotFoundError) {
    const wrapped = new Error(error.message) as Error & { code?: string }
    wrapped.code = error.code
    throw wrapped
  }
  if (error instanceof ChatSessionApplyPolicyError) {
    const wrapped = new Error(error.message) as Error & { code?: string }
    wrapped.code = error.code
    throw wrapped
  }
  throw error
}

export function registerChatSessionIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.chatSessionGetPendingChanges, async (_event, raw) => {
    const input = parseIpcInput(
      chatSessionThreadInputSchema,
      raw,
      IPC_CHANNELS.chatSessionGetPendingChanges,
    )
    if (!input) throw new Error('Invalid chat session pending changes input')
    try {
      const result = await ctx.session.getChatSessionPendingChanges(
        input.threadId,
        input.expectedSessionId,
      )
      return parseIpcOutput(
        chatSessionPendingChangesResultSchema,
        result,
        IPC_CHANNELS.chatSessionGetPendingChanges,
      )
    } catch (error) {
      rethrowApplyError(error)
    }
  })

  registerHandler(ctx, IPC_CHANNELS.chatSessionGetPendingChangeFile, async (_event, raw) => {
    const input = parseIpcInput(
      chatSessionPendingChangeFileInputSchema,
      raw,
      IPC_CHANNELS.chatSessionGetPendingChangeFile,
    )
    if (!input) throw new Error('Invalid chat session pending change file input')
    try {
      const result = await ctx.session.getChatSessionPendingChangeFile(input)
      return parseIpcOutput(
        chatSessionPendingChangeFileResultSchema,
        result,
        IPC_CHANNELS.chatSessionGetPendingChangeFile,
      )
    } catch (error) {
      rethrowApplyError(error)
    }
  })

  registerHandler(ctx, IPC_CHANNELS.chatSessionApplyChanges, async (_event, raw) => {
    const input = parseIpcInput(
      chatSessionApplyChangesInputSchema,
      raw,
      IPC_CHANNELS.chatSessionApplyChanges,
    )
    if (!input) throw new Error('Invalid chat session apply changes input')
    try {
      const result = await ctx.session.applyChatSessionChanges(input)
      return parseIpcOutput(
        chatSessionApplyChangesResultSchema,
        result,
        IPC_CHANNELS.chatSessionApplyChanges,
      )
    } catch (error) {
      rethrowApplyError(error)
    }
  })
}
