import { IPC_CHANNELS, resolveChatMcpEnabledByProvider } from '@planetz/shared'
import {
  isChatAgentModeEnabled,
  isConversationModeEnabled,
  resolveChatAgentSupportByProvider,
  resolveChatGatewayCapability,
} from '../lib/conversation-mode-env.js'
import { isDevProvidersEnvironment } from '../lib/dev-providers-env.js'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerDesktopIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.desktopGetCapabilities, async () => ({
    conversationModeEnabled: isConversationModeEnabled(),
    chatGateway: resolveChatGatewayCapability(),
    devProvidersAvailable: isDevProvidersEnvironment(),
    chatAgentEnabled: isChatAgentModeEnabled(),
    chatAgentSupportByProvider: resolveChatAgentSupportByProvider(),
    chatMcpEnabledByProvider: resolveChatMcpEnabledByProvider(),
  }))
}
