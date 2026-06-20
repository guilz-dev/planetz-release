import {
  githubIssueFetchInputSchema,
  githubIssueListOpenInputSchema,
  githubIssueListOpenResultSchema,
  githubIssueViewSchema,
  IPC_CHANNELS,
  parseIpcInput,
  parseIpcOutput,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler } from './ipc-handler-utils.js'

export function registerGitHubIssueIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.githubIssueListOpen, async (_event, raw) => {
    const input = parseIpcInput(
      githubIssueListOpenInputSchema,
      raw,
      IPC_CHANNELS.githubIssueListOpen,
    )
    const issues = await ctx.session.listOpenGitHubIssues(input)
    return parseIpcOutput(githubIssueListOpenResultSchema, issues, IPC_CHANNELS.githubIssueListOpen)
  })

  registerHandler(ctx, IPC_CHANNELS.githubIssueFetch, async (_event, raw) => {
    const input = parseIpcInput(githubIssueFetchInputSchema, raw, IPC_CHANNELS.githubIssueFetch)
    const issue = await ctx.session.fetchGitHubIssue(input)
    return parseIpcOutput(githubIssueViewSchema, issue, IPC_CHANNELS.githubIssueFetch)
  })
}
