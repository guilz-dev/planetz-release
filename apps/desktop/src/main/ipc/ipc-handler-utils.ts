import { parseIpcInput } from '@planetz/shared'
import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import type { z } from 'zod'
import { broadcastAfterMutation, type IpcContext } from './ipc-context.js'

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>

/** Read-only or custom handlers (no automatic broadcast). */
export function registerHandler(_ctx: IpcContext, channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, handler)
}

/** Parse input, run fn, then broadcast state update. */
export function registerMutationHandler<T>(
  ctx: IpcContext,
  channel: string,
  schema: z.ZodType<T>,
  fn: (input: T) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, async (_event, raw) => {
    const input = parseIpcInput(schema, raw, channel)
    const result = await fn(input)
    broadcastAfterMutation(ctx)
    return result
  })
}

/** Run fn with no IPC payload, then broadcast state update. */
export function registerMutationHandlerNoInput(
  ctx: IpcContext,
  channel: string,
  fn: () => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, async () => {
    const result = await fn()
    broadcastAfterMutation(ctx)
    return result
  })
}

export function broadcastMutation(ctx: IpcContext): void {
  broadcastAfterMutation(ctx)
}
