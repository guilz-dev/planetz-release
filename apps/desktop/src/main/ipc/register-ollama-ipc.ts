import {
  IPC_CHANNELS,
  ollamaExecutionGuardPreviewInputSchema,
  ollamaHealthGetInputSchema,
  ollamaModelAdminInputSchema,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerOllamaIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.ollamaHealthGet, async (_event, raw) => {
    const input = parseIpcInput(ollamaHealthGetInputSchema, raw, IPC_CHANNELS.ollamaHealthGet)
    return ctx.session.getOllamaHealth(input)
  })

  registerHandler(ctx, IPC_CHANNELS.ollamaExecutionGuardPreview, async (_event, raw) => {
    const input = parseIpcInput(
      ollamaExecutionGuardPreviewInputSchema,
      raw,
      IPC_CHANNELS.ollamaExecutionGuardPreview,
    )
    return ctx.session.previewOllamaExecutionGuard(input)
  })

  registerHandler(ctx, IPC_CHANNELS.ollamaModelPull, async (_event, raw) => {
    const input = parseIpcInput(ollamaModelAdminInputSchema, raw, IPC_CHANNELS.ollamaModelPull)
    const engineConfig = await ctx.session.resolveEngineConfigForOllamaAdmin(
      input.engineConfigPreview,
    )
    await ctx.session.localLlmService.pullModel('ollama', input.model, engineConfig)
    return { ok: true as const }
  })

  registerHandler(ctx, IPC_CHANNELS.ollamaModelDelete, async (_event, raw) => {
    const input = parseIpcInput(ollamaModelAdminInputSchema, raw, IPC_CHANNELS.ollamaModelDelete)
    const engineConfig = await ctx.session.resolveEngineConfigForOllamaAdmin(
      input.engineConfigPreview,
    )
    await ctx.session.localLlmService.deleteModel('ollama', input.model, engineConfig)
    return { ok: true as const }
  })
}
