import {
  decidedIntentSaveInputSchema,
  decidedIntentThreadInputSchema,
  IPC_CHANNELS,
  intentDraftGenerateInputSchema,
  intentDraftSaveInputSchema,
  intentDraftThreadInputSchema,
  parseIpcInput,
  specThreadSummaryListInputSchema,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

/** Spec Studio reads: thread summaries and the decided-intent document. */
export function registerSpecStudioIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.specThreadSummaryList, async (_event, raw) => {
    const input = parseIpcInput(
      specThreadSummaryListInputSchema,
      raw,
      IPC_CHANNELS.specThreadSummaryList,
    )
    return ctx.session.listSpecThreadSummaries(input ?? undefined)
  })

  registerHandler(ctx, IPC_CHANNELS.decidedIntentGetCurrent, async (_event, raw) => {
    const input = parseIpcInput(
      decidedIntentThreadInputSchema,
      raw,
      IPC_CHANNELS.decidedIntentGetCurrent,
    )
    return ctx.session.getCurrentDecidedIntent(input)
  })

  registerHandler(ctx, IPC_CHANNELS.decidedIntentListVersions, async (_event, raw) => {
    const input = parseIpcInput(
      decidedIntentThreadInputSchema,
      raw,
      IPC_CHANNELS.decidedIntentListVersions,
    )
    return ctx.session.listDecidedIntentVersions(input)
  })

  registerHandler(ctx, IPC_CHANNELS.decidedIntentSave, async (_event, raw) => {
    const input = parseIpcInput(decidedIntentSaveInputSchema, raw, IPC_CHANNELS.decidedIntentSave)
    return ctx.session.saveDecidedIntent(input)
  })

  registerHandler(ctx, IPC_CHANNELS.intentDraftGet, async (_event, raw) => {
    const input = parseIpcInput(intentDraftThreadInputSchema, raw, IPC_CHANNELS.intentDraftGet)
    return ctx.session.getIntentDraft(input)
  })

  registerHandler(ctx, IPC_CHANNELS.intentDraftSave, async (_event, raw) => {
    const input = parseIpcInput(intentDraftSaveInputSchema, raw, IPC_CHANNELS.intentDraftSave)
    return ctx.session.saveIntentDraft(input)
  })

  registerHandler(ctx, IPC_CHANNELS.intentDraftGenerate, async (_event, raw) => {
    const input = parseIpcInput(
      intentDraftGenerateInputSchema,
      raw,
      IPC_CHANNELS.intentDraftGenerate,
    )
    return ctx.session.generateIntentDraft(input)
  })

  registerHandler(ctx, IPC_CHANNELS.intentDraftClear, async (_event, raw) => {
    const input = parseIpcInput(intentDraftThreadInputSchema, raw, IPC_CHANNELS.intentDraftClear)
    return ctx.session.clearIntentDraft(input)
  })

  registerHandler(ctx, IPC_CHANNELS.validationCoverageGetSummary, async () => {
    return ctx.session.getValidationCoverageSummary()
  })
}
