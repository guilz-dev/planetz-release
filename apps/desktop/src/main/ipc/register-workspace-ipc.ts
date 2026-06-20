import {
  IPC_CHANNELS,
  parseIpcInput,
  workspaceCurrentGitBranchResultSchema,
  workspaceGitBranchesResultSchema,
  workspaceInitializeInputSchema,
  workspaceRecentPathInputSchema,
  workspaceSetBootstrapInputSchema,
} from '@planetz/shared'
import { dialog, type OpenDialogOptions } from 'electron'
import { execa } from 'execa'
import { detectGitDefaultBranch } from '../lib/git-default-branch.js'
import { syncMockAnimatorLoop } from '../lib/sync-mock-animator.js'
import type { IpcContext } from './ipc-context.js'
import { broadcastMutation, registerHandler } from './ipc-handler-utils.js'

const WORKSPACE_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openDirectory', 'createDirectory'],
}

export function registerWorkspaceIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.workspaceSelect, async () => {
    const win = ctx.getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, WORKSPACE_DIALOG_OPTIONS)
      : await dialog.showOpenDialog(WORKSPACE_DIALOG_OPTIONS)
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }
    const path = result.filePaths[0]
    const state = await ctx.session.openWorkspace(path)
    syncMockAnimatorLoop(ctx.session, ctx.getWindow)
    broadcastMutation(ctx)
    return { canceled: false as const, path, state }
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceGet, async () => {
    const startupWaitOutcome = await ctx.session.waitForStartupSettled()
    if (startupWaitOutcome === 'timed_out') {
      console.warn(
        '[workspace-ipc] startup restore wait timed out; returning current workspace snapshot',
      )
    }
    return {
      path: ctx.session.workspacePath,
      state: ctx.session.getState(),
    }
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceCurrentGitBranch, async () => {
    const workspacePath = ctx.session.workspacePath
    if (!workspacePath) {
      return workspaceCurrentGitBranchResultSchema.parse({ branch: null })
    }
    const head = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspacePath,
      reject: false,
    })
    if (head.exitCode === 0) {
      const name = head.stdout.trim()
      if (name && name !== 'HEAD') {
        return workspaceCurrentGitBranchResultSchema.parse({ branch: name })
      }
    }
    const fallback = await detectGitDefaultBranch(workspacePath)
    return workspaceCurrentGitBranchResultSchema.parse({ branch: fallback })
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceGitBranches, async () => {
    const workspacePath = ctx.session.workspacePath
    if (!workspacePath) {
      return workspaceGitBranchesResultSchema.parse({ branches: [], currentBranch: null })
    }
    const [branchList, head] = await Promise.all([
      execa('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], {
        cwd: workspacePath,
        reject: false,
      }),
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: workspacePath,
        reject: false,
      }),
    ])
    const listedBranches =
      branchList.exitCode === 0
        ? branchList.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : []
    let currentBranch: string | null = null
    if (head.exitCode === 0) {
      const name = head.stdout.trim()
      if (name && name !== 'HEAD') {
        currentBranch = name
      }
    }
    if (!currentBranch) {
      currentBranch = await detectGitDefaultBranch(workspacePath)
    }
    const branches =
      currentBranch && listedBranches.includes(currentBranch)
        ? [currentBranch, ...listedBranches.filter((branch) => branch !== currentBranch)]
        : currentBranch
          ? [currentBranch, ...listedBranches]
          : listedBranches
    return workspaceGitBranchesResultSchema.parse({
      branches,
      currentBranch,
    })
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceListRecent, () => ctx.session.listRecentWorkspaces())

  registerHandler(ctx, IPC_CHANNELS.workspaceOpenRecent, async (_event, raw) => {
    const input = parseIpcInput(
      workspaceRecentPathInputSchema,
      raw,
      IPC_CHANNELS.workspaceOpenRecent,
    )
    const result = await ctx.session.openRecentWorkspace(input.path)
    syncMockAnimatorLoop(ctx.session, ctx.getWindow)
    broadcastMutation(ctx)
    return result
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceRemoveRecent, async (_event, raw) => {
    const input = parseIpcInput(
      workspaceRecentPathInputSchema,
      raw,
      IPC_CHANNELS.workspaceRemoveRecent,
    )
    return ctx.session.removeRecentWorkspace(input.path)
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceSetBootstrap, async (_event, raw) => {
    const input = parseIpcInput(
      workspaceSetBootstrapInputSchema,
      raw,
      IPC_CHANNELS.workspaceSetBootstrap,
    )
    const state = await ctx.session.setBootstrapOverride(input.status)
    syncMockAnimatorLoop(ctx.session, ctx.getWindow)
    broadcastMutation(ctx)
    return state
  })

  registerHandler(ctx, IPC_CHANNELS.workspaceInitialize, async (_event, raw) => {
    const input = parseIpcInput(
      workspaceInitializeInputSchema,
      raw,
      IPC_CHANNELS.workspaceInitialize,
    )
    const state = await ctx.session.initializeWorkspace(input.createTaktDir)
    syncMockAnimatorLoop(ctx.session, ctx.getWindow)
    broadcastMutation(ctx)
    return state
  })

  registerHandler(ctx, IPC_CHANNELS.watchStart, async () => {
    await ctx.session.startWatch()
    broadcastMutation(ctx)
    return ctx.session.connection
  })

  registerHandler(ctx, IPC_CHANNELS.watchStop, async () => {
    await ctx.session.stopWatch()
    broadcastMutation(ctx)
    return ctx.session.connection
  })
}
