import {
  composerSessionAcceptInputSchema,
  composerSessionCancelInputSchema,
  composerSessionFinalizeInputSchema,
  composerSessionInterruptInputSchema,
  composerSessionMessageInputSchema,
  composerSessionPlayInputSchema,
  composerSessionResumeInputSchema,
  composerSessionStartInputSchema,
  composerSourceContextBuildInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerComposerIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.composerSessionStart, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionStartInputSchema,
      raw,
      IPC_CHANNELS.composerSessionStart,
    )
    return ctx.session.startComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionGetActive, async () => {
    return ctx.session.getActiveComposerSession()
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionGetCapabilities, async () => {
    return ctx.session.getComposerAssistCapabilities()
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionResume, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionResumeInputSchema,
      raw,
      IPC_CHANNELS.composerSessionResume,
    )
    return ctx.session.resumeComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionMessage, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionMessageInputSchema,
      raw,
      IPC_CHANNELS.composerSessionMessage,
    )
    return ctx.session.messageComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionFinalize, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionFinalizeInputSchema,
      raw,
      IPC_CHANNELS.composerSessionFinalize,
    )
    return ctx.session.finalizeComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionAccept, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionAcceptInputSchema,
      raw,
      IPC_CHANNELS.composerSessionAccept,
    )
    return ctx.session.acceptComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionPlay, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionPlayInputSchema,
      raw,
      IPC_CHANNELS.composerSessionPlay,
    )
    return ctx.session.playComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionBuildSourceContext, async (_event, raw) => {
    const input = parseIpcInput(
      composerSourceContextBuildInputSchema,
      raw,
      IPC_CHANNELS.composerSessionBuildSourceContext,
    )
    return ctx.session.buildComposerSourceContext(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionCancel, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionCancelInputSchema,
      raw,
      IPC_CHANNELS.composerSessionCancel,
    )
    await ctx.session.cancelComposerSession(input)
  })

  registerHandler(ctx, IPC_CHANNELS.composerSessionInterrupt, async (_event, raw) => {
    const input = parseIpcInput(
      composerSessionInterruptInputSchema,
      raw,
      IPC_CHANNELS.composerSessionInterrupt,
    )
    await ctx.session.interruptComposerSession(input)
  })
}
