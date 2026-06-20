import {
  chainCheckBranchInputSchema,
  chainCreateInputSchema,
  chainDeleteInputSchema,
  chainMaterializeInputSchema,
  chainSetEdgeStatusInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerChainIpc(ctx: IpcContext): void {
  registerMutationHandler(ctx, IPC_CHANNELS.chainCreate, chainCreateInputSchema, (input) =>
    ctx.session.createChainTask(input),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.chainMaterialize,
    chainMaterializeInputSchema,
    (input) => ctx.session.materializeChainEdge(input),
  )

  registerHandler(ctx, IPC_CHANNELS.chainCheckBranch, async (_event, raw) => {
    const input = parseIpcInput(chainCheckBranchInputSchema, raw, IPC_CHANNELS.chainCheckBranch)
    return ctx.session.checkChainSourceBranch(input.branch)
  })

  registerMutationHandler(ctx, IPC_CHANNELS.chainDelete, chainDeleteInputSchema, async (input) => {
    await ctx.session.removeChain(input.chainId, input.edgeKey)
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.chainSetEdgeStatus,
    chainSetEdgeStatusInputSchema,
    async (input) => {
      await ctx.session.setChainEdgeStatus(
        input.chainId,
        input.fromTaskId,
        input.toTaskId,
        input.status,
      )
    },
  )
}
