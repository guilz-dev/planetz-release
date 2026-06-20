import {
  executionLogListInputSchema,
  executionSummaryGetInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerExecutionIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.executionLogList, async (_event, raw) => {
    const input = parseIpcInput(executionLogListInputSchema, raw, IPC_CHANNELS.executionLogList)
    return ctx.session.listExecutionLog(input ?? undefined)
  })

  registerHandler(ctx, IPC_CHANNELS.executionSummaryGet, async (_event, raw) => {
    const input = parseIpcInput(
      executionSummaryGetInputSchema,
      raw,
      IPC_CHANNELS.executionSummaryGet,
    )
    return ctx.session.getExecutionSummary(input ?? undefined)
  })
}
