import {
  createResultPrInputSchema,
  createResultPrResultSchema,
  enqueueTaskBridgeInputSchema,
  IPC_CHANNELS,
  parseIpcInput,
  parseIpcOutput,
  promptHistoryDeleteInputSchema,
  promptHistoryListInputSchema,
  resultBranchInputSchema,
  resultCheckBranchInputSchema,
  resultCheckBranchResultSchema,
  resultDiffFileInputSchema,
  selectTaskInputSchema,
  taskIdInputSchema,
  taskPromptInputSchema,
  taskResultBundleSchema,
  taskResultDiffFileSchema,
  taskResultDiffSummarySchema,
  taskResultPathOpenInputSchema,
  taskSwapWorkflowInputSchema,
} from '@planetz/shared'
import type { IpcContext } from './ipc-context.js'
import { registerHandler, registerMutationHandler } from './ipc-handler-utils.js'

export function registerTaskIpc(ctx: IpcContext): void {
  registerMutationHandler(ctx, IPC_CHANNELS.taskEnqueue, enqueueTaskBridgeInputSchema, (input) =>
    ctx.session.enqueueTask(input),
  )

  registerMutationHandler(ctx, IPC_CHANNELS.taskRetry, taskIdInputSchema, (input) =>
    ctx.session.retryTask(input.taskId),
  )

  registerMutationHandler(ctx, IPC_CHANNELS.taskResume, taskPromptInputSchema, (input) =>
    ctx.session.resumeTask(input.taskId, input.prompt),
  )

  registerMutationHandler(ctx, IPC_CHANNELS.taskStop, taskIdInputSchema, async (input) => {
    await ctx.session.stopTask(input.taskId)
  })

  registerMutationHandler(ctx, IPC_CHANNELS.taskResumeStopped, taskIdInputSchema, async (input) => {
    await ctx.session.resumeStoppedTask(input.taskId)
  })

  registerMutationHandler(ctx, IPC_CHANNELS.taskRevise, taskPromptInputSchema, (input) =>
    ctx.session.reviseTask(input.taskId, input.prompt),
  )

  registerMutationHandler(ctx, IPC_CHANNELS.taskDelete, taskIdInputSchema, async (input) => {
    await ctx.session.deleteTask(input.taskId)
  })

  registerHandler(ctx, IPC_CHANNELS.promptHistoryList, async (_event, raw) => {
    const input = parseIpcInput(promptHistoryListInputSchema, raw, IPC_CHANNELS.promptHistoryList)
    return ctx.session.listPromptHistory(input?.limit)
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.promptHistoryDelete,
    promptHistoryDeleteInputSchema,
    async (input) => {
      await ctx.session.deletePromptHistoryItem(input.id)
    },
  )

  registerMutationHandler(ctx, IPC_CHANNELS.uiSelectTask, selectTaskInputSchema, async (input) => {
    await ctx.session.persistUiState({ selectedTaskId: input.taskId })
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.taskRunNow,
    enqueueTaskBridgeInputSchema,
    async (input) => {
      return ctx.session.runTaskNow(input)
    },
  )

  registerMutationHandler(ctx, IPC_CHANNELS.taskRunPending, taskIdInputSchema, async (input) => {
    await ctx.session.runPendingTask(input.taskId)
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.taskSwapWorkflow,
    taskSwapWorkflowInputSchema,
    (input) => ctx.session.swapTaskWorkflow(input),
  )

  registerHandler(ctx, IPC_CHANNELS.resultDiffSummary, async (_event, raw) => {
    const input = parseIpcInput(resultBranchInputSchema, raw, IPC_CHANNELS.resultDiffSummary)
    const summary = await ctx.session.listTaskResultDiff(input.taskId, input.branch)
    return parseIpcOutput(taskResultDiffSummarySchema, summary, IPC_CHANNELS.resultDiffSummary)
  })

  registerHandler(ctx, IPC_CHANNELS.resultDiffFile, async (_event, raw) => {
    const input = parseIpcInput(resultDiffFileInputSchema, raw, IPC_CHANNELS.resultDiffFile)
    const payload = await ctx.session.getTaskResultDiffFile(input.taskId, input.branch, input.path)
    return parseIpcOutput(taskResultDiffFileSchema, payload, IPC_CHANNELS.resultDiffFile)
  })

  registerHandler(ctx, IPC_CHANNELS.resultMerge, async (_event, raw) => {
    const input = parseIpcInput(resultBranchInputSchema, raw, IPC_CHANNELS.resultMerge)
    return ctx.session.mergeResult(input.taskId, input.branch)
  })

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.resultCreatePr,
    createResultPrInputSchema,
    async (input) => {
      const result = await ctx.session.createResultPr(input)
      return parseIpcOutput(createResultPrResultSchema, result, IPC_CHANNELS.resultCreatePr)
    },
  )

  registerHandler(ctx, IPC_CHANNELS.resultCheckBranch, async (_event, raw) => {
    const input = parseIpcInput(resultCheckBranchInputSchema, raw, IPC_CHANNELS.resultCheckBranch)
    const result = await ctx.session.checkResultBranch(input.taskId, input.branch)
    return parseIpcOutput(resultCheckBranchResultSchema, result, IPC_CHANNELS.resultCheckBranch)
  })

  registerHandler(ctx, IPC_CHANNELS.taskOpenWorkDir, async (_event, raw) => {
    const input = parseIpcInput(taskIdInputSchema, raw, IPC_CHANNELS.taskOpenWorkDir)
    return ctx.session.openTaskWorkDir(input.taskId)
  })

  registerHandler(ctx, IPC_CHANNELS.taskOpenResultPath, async (_event, raw) => {
    const input = parseIpcInput(taskResultPathOpenInputSchema, raw, IPC_CHANNELS.taskOpenResultPath)
    return ctx.session.openTaskResultPath(input)
  })

  registerHandler(ctx, IPC_CHANNELS.conversationListForTask, async (_event, raw) => {
    const input = parseIpcInput(taskIdInputSchema, raw, IPC_CHANNELS.conversationListForTask)
    return ctx.session.listConversations(input.taskId)
  })

  registerHandler(ctx, IPC_CHANNELS.taskGetResult, async (_event, raw) => {
    const input = parseIpcInput(taskIdInputSchema, raw, IPC_CHANNELS.taskGetResult)
    const bundle = await ctx.session.getTaskResult(input.taskId)
    return parseIpcOutput(taskResultBundleSchema, bundle, IPC_CHANNELS.taskGetResult)
  })
}
