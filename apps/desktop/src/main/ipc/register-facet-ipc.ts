import {
  facetDeleteProjectInputSchema,
  facetListUsagesInputSchema,
  facetReadInputSchema,
  facetWriteProjectInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
} from '@planetz/shared'
import {
  deleteProjectFacet,
  listProjectFacets,
  readFacetByKindKey,
  writeProjectFacet,
} from '../takt/facet-resolver.js'
import { listFacetUsages } from '../takt/facet-usage.js'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerFacetIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.facetListProject, () => {
    const workspacePath = ctx.session.workspacePath
    const config = ctx.session.config
    if (!workspacePath || !config) return []
    return listProjectFacets(workspacePath, config)
  })

  registerHandler(ctx, IPC_CHANNELS.facetRead, (_event, raw) => {
    const input = parseIpcInput(facetReadInputSchema, raw, IPC_CHANNELS.facetRead)
    const workspacePath = ctx.session.workspacePath
    const config = ctx.session.config
    if (!workspacePath || !config) {
      throw new Error('workspace not open')
    }
    const taktRepo = ctx.session.taktExecutionPath ?? undefined
    return readFacetByKindKey(workspacePath, config, input.kind, input.key, input.source, {
      taktRepoPath: taktRepo,
    })
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.facetWriteProject,
    facetWriteProjectInputSchema,
    async (input) => {
      const workspacePath = ctx.session.requireWorkspacePath()
      const config = ctx.session.requireConfig()
      return writeProjectFacet(workspacePath, config, input.kind, input.key, input.content)
    },
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.facetDeleteProject,
    facetDeleteProjectInputSchema,
    async (input) => {
      const workspacePath = ctx.session.requireWorkspacePath()
      const config = ctx.session.requireConfig()
      await deleteProjectFacet(workspacePath, config, input.kind, input.key)
    },
  )

  registerHandler(ctx, IPC_CHANNELS.facetListUsages, (_event, raw) => {
    const input = parseIpcInput(facetListUsagesInputSchema, raw, IPC_CHANNELS.facetListUsages)
    const workspacePath = ctx.session.workspacePath
    const config = ctx.session.config
    if (!workspacePath || !config) return { workflowCount: 0, stepCount: 0, workflowNames: [] }
    return listFacetUsages(workspacePath, config, input.kind, input.key)
  })
}
