import {
  IPC_CHANNELS,
  intentLedgerAdoptInputSchema,
  intentLedgerCountPendingInputSchema,
  intentLedgerEntryIdInputSchema,
  intentLedgerFixInputSchema,
  intentLedgerGetSummaryInputSchema,
  intentLedgerListByThreadInputSchema,
  intentLedgerListPendingInputSchema,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerIntentLedgerIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.intentLedgerListPending, async (_event, raw) => {
    const input = parseIpcInput(
      intentLedgerListPendingInputSchema,
      raw,
      IPC_CHANNELS.intentLedgerListPending,
    )
    return ctx.session.listPendingIntentLedger(input ?? undefined)
  })

  registerHandler(ctx, IPC_CHANNELS.intentLedgerCountPending, async (_event, raw) => {
    const input = parseIpcInput(
      intentLedgerCountPendingInputSchema,
      raw,
      IPC_CHANNELS.intentLedgerCountPending,
    )
    return ctx.session.countPendingIntentLedger(input ?? undefined)
  })

  registerHandler(ctx, IPC_CHANNELS.intentLedgerGetSummary, async (_event, raw) => {
    const input = parseIpcInput(
      intentLedgerGetSummaryInputSchema,
      raw,
      IPC_CHANNELS.intentLedgerGetSummary,
    )
    return ctx.session.getIntentLedgerSummary(input ?? undefined)
  })

  registerHandler(ctx, IPC_CHANNELS.intentLedgerListByThread, async (_event, raw) => {
    const input = parseIpcInput(
      intentLedgerListByThreadInputSchema,
      raw,
      IPC_CHANNELS.intentLedgerListByThread,
    )
    return ctx.session.listIntentLedgerByThread(input)
  })

  registerHandler(ctx, IPC_CHANNELS.intentLedgerListSupply, async () => {
    return ctx.session.listSupplyIntentLedger()
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.intentLedgerRatify,
    intentLedgerEntryIdInputSchema,
    (input) => ctx.session.ratifyIntentLedgerEntry(input.entryId),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.intentLedgerReverse,
    intentLedgerEntryIdInputSchema,
    (input) => ctx.session.reverseIntentLedgerEntry(input.entryId),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.intentLedgerAdopt,
    intentLedgerAdoptInputSchema,
    (input) => ctx.session.adoptIntentLedgerEntry(input),
  )

  registerMutationHandler(ctx, IPC_CHANNELS.intentLedgerFix, intentLedgerFixInputSchema, (input) =>
    ctx.session.fixIntentLedgerEntry(input),
  )
}
