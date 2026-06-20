import type { IpcContext } from './ipc-context.js'
import { registerChainIpc } from './register-chain-ipc.js'
import { registerChatComposerDraftIpc } from './register-chat-composer-draft-ipc.js'
import { registerChatMcpIpc } from './register-chat-mcp-ipc.js'
import { registerChatSessionIpc } from './register-chat-session-ipc.js'
import { registerChatToTaskMetricsIpc } from './register-chat-to-task-metrics-ipc.js'
import { registerComposerIpc } from './register-composer-ipc.js'
import { registerConversationHistoryIpc } from './register-conversation-history-ipc.js'
import { registerDesktopIpc } from './register-desktop-ipc.js'
import { registerExecutionIpc } from './register-execution-ipc.js'
import { registerFacetIpc } from './register-facet-ipc.js'
import { registerGitHubIssueIpc } from './register-github-issue-ipc.js'
import { registerIntegrationIpc } from './register-integration-ipc.js'
import { registerIntentLedgerIpc } from './register-intent-ledger-ipc.js'
import { registerKiroSpecIpc } from './register-kiro-spec-ipc.js'
import { registerOllamaIpc } from './register-ollama-ipc.js'
import { registerProviderEffortsIpc } from './register-provider-efforts-ipc.js'
import { registerProviderModelsIpc } from './register-provider-models-ipc.js'
import { registerSettingsIpc } from './register-settings-ipc.js'
import { registerSpecStudioIpc } from './register-spec-studio-ipc.js'
import { registerTaskIpc } from './register-task-ipc.js'
import { registerWorkflowIpc } from './register-workflow-ipc.js'
import { registerWorkspaceIpc } from './register-workspace-ipc.js'

export function registerIpc(ctx: IpcContext): void {
  registerWorkspaceIpc(ctx)
  registerDesktopIpc(ctx)
  registerSettingsIpc(ctx)
  registerProviderModelsIpc(ctx)
  registerOllamaIpc(ctx)
  registerProviderEffortsIpc(ctx)
  registerTaskIpc(ctx)
  registerConversationHistoryIpc(ctx)
  registerChatComposerDraftIpc(ctx)
  registerChatSessionIpc(ctx)
  registerChatMcpIpc(ctx)
  registerChatToTaskMetricsIpc(ctx)
  registerComposerIpc(ctx)
  registerWorkflowIpc(ctx)
  registerFacetIpc(ctx)
  registerChainIpc(ctx)
  registerIntegrationIpc(ctx)
  registerExecutionIpc(ctx)
  registerGitHubIssueIpc(ctx)
  registerIntentLedgerIpc(ctx)
  registerSpecStudioIpc(ctx)
  registerKiroSpecIpc(ctx)
}
