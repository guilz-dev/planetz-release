import { chatToTaskMetricRecordInputSchema, IPC_CHANNELS, parseIpcInput } from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerChatToTaskMetricsIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.chatToTaskMetricRecord, async (_event, raw) => {
    const input = parseIpcInput(
      chatToTaskMetricRecordInputSchema,
      raw,
      IPC_CHANNELS.chatToTaskMetricRecord,
    )
    await ctx.session.recordChatToTaskMetric(input)
  })
}
