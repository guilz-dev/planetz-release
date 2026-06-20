import {
  agentOverridesUpdateInputSchema,
  canonicalImportConfirmInputSchema,
  engineConfigImportInputSchema,
  engineConfigUpdateInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
  settingsUpdateInputSchema,
  taktGlobalImportFromHomeInputSchema,
  workflowImportFromTaktInputSchema,
  yamlOpenInputSchema,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import {
  broadcastMutation,
  registerHandler,
  registerMutationHandler,
  registerMutationHandlerNoInput,
} from './ipc-handler-utils.js'

export function registerSettingsIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.settingsGet, () => ({
    workspacePath: ctx.session.workspacePath,
    config: ctx.session.getConfig(),
  }))

  registerHandler(ctx, IPC_CHANNELS.settingsUpdate, async (_event, raw) => {
    const patch = parseIpcInput(settingsUpdateInputSchema, raw, IPC_CHANNELS.settingsUpdate)
    const config = await ctx.session.updateConfig(patch)
    await ctx.session.refreshConnection()
    broadcastMutation(ctx)
    return { config, connection: ctx.session.connection }
  })

  registerHandler(ctx, IPC_CHANNELS.engineConfigGet, async () => ctx.session.getEngineConfig())

  registerHandler(ctx, IPC_CHANNELS.agentOverridesGet, async () => ctx.session.getAgentOverrides())

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.agentOverridesUpdate,
    agentOverridesUpdateInputSchema,
    (patch) => ctx.session.updateAgentOverrides(patch),
  )

  registerHandler(ctx, IPC_CHANNELS.yamlOpen, async (_event, raw) => {
    const input = parseIpcInput(yamlOpenInputSchema, raw, IPC_CHANNELS.yamlOpen)
    return ctx.session.openYaml(input)
  })

  registerHandler(ctx, IPC_CHANNELS.executionCatalogList, async () =>
    ctx.session.listExecutionCatalog(),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.engineConfigUpdate,
    engineConfigUpdateInputSchema,
    (patch) => ctx.session.updateEngineConfig(patch),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.engineConfigImportFromTakt,
    engineConfigImportInputSchema,
    (input) => ctx.session.importEngineConfigFromTakt({ overwrite: input.overwrite }),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.taktGlobalImportFromHome,
    taktGlobalImportFromHomeInputSchema,
    (input) => ctx.session.importGlobalTaktFromHome({ overwrite: input.overwrite }),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.workflowImportFromTakt,
    workflowImportFromTaktInputSchema,
    (input) => ctx.session.importWorkflowFromTakt(input.name, { overwrite: input.overwrite }),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.canonicalImportConfirm,
    canonicalImportConfirmInputSchema,
    (input) => ctx.session.confirmCanonicalImport({ importHomeGlobal: input.importHomeGlobal }),
  )

  registerMutationHandlerNoInput(ctx, IPC_CHANNELS.canonicalImportDismiss, () =>
    ctx.session.dismissCanonicalImport(),
  )

  registerHandler(ctx, IPC_CHANNELS.connectionGetStatus, async () => {
    const connection = await ctx.session.refreshConnection()
    broadcastMutation(ctx)
    return connection
  })
}
