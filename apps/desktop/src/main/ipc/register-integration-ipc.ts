import {
  IPC_CHANNELS,
  integrationsPushExternalInputSchema,
  integrationsToggleAdapterInputSchema,
  integrationsToggleHookServerInputSchema,
  parseIpcInput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { broadcastMutation, registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerIntegrationIpc(ctx: IpcContext): void {
  registerMutationHandler(
    ctx,
    IPC_CHANNELS.integrationsToggleHookServer,
    integrationsToggleHookServerInputSchema,
    (input) => ctx.session.toggleHookServer(input),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.integrationsToggleAdapter,
    integrationsToggleAdapterInputSchema,
    (input) => ctx.session.toggleAdapter(input.id, input.enabled),
  )

  registerHandler(ctx, IPC_CHANNELS.integrationsPushExternal, (_event, raw) => {
    const input = parseIpcInput(
      integrationsPushExternalInputSchema,
      raw,
      IPC_CHANNELS.integrationsPushExternal,
    )
    ctx.session.pushExternalAgent(input.id)
    broadcastMutation(ctx)
  })
}
