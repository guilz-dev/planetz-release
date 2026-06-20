import { readFile } from 'node:fs/promises'
import {
  IPC_CHANNELS,
  parseIpcInput,
  workflowDraftDeleteInputSchema,
  workflowDraftLoadInputSchema,
  workflowDraftSaveInputSchema,
  workflowGetPreviewInputSchema,
  workflowPreviewAutoRouteInputSchema,
  workflowReadFacetsInputSchema,
  workflowReadInputSchema,
  workflowValidateInputSchema,
  workflowWriteProjectInputSchema,
} from '@planetz/shared'
import { dialog, type OpenDialogOptions } from 'electron'
import {
  deleteWorkflowDraft,
  loadWorkflowDraft,
  saveWorkflowDraft,
} from '../lib/workflow-draft-store.js'
import type { IpcContext } from './ipc-context.js'
import {
  registerHandler,
  registerMutationHandler,
  registerMutationHandlerNoInput,
} from './ipc-handler-utils.js'

const WORKFLOW_IMPORT_YAML_DIALOG: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: 'Workflow YAML', extensions: ['yaml', 'yml'] }],
}

export function registerWorkflowIpc(ctx: IpcContext): void {
  registerHandler(ctx, IPC_CHANNELS.workflowGetPreview, (_event, raw) => {
    const input = parseIpcInput(workflowGetPreviewInputSchema, raw, IPC_CHANNELS.workflowGetPreview)
    return ctx.session.getWorkflowPreview(input)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowPreviewAutoRoute, (_event, raw) => {
    const input = parseIpcInput(
      workflowPreviewAutoRouteInputSchema,
      raw,
      IPC_CHANNELS.workflowPreviewAutoRoute,
    )
    return ctx.session.previewWorkflowAutoRoute(input)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowList, () => ctx.session.workflowManager.list())

  registerHandler(ctx, IPC_CHANNELS.workflowRead, (_event, raw) => {
    const input = parseIpcInput(workflowReadInputSchema, raw, IPC_CHANNELS.workflowRead)
    return ctx.session.workflowManager.read(input.nameOrPath, input.source)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowReadFacets, (_event, raw) => {
    const input = parseIpcInput(workflowReadFacetsInputSchema, raw, IPC_CHANNELS.workflowReadFacets)
    return ctx.session.workflowManager.readFacets(input.managedPaths)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowListBuiltinFacets, () =>
    ctx.session.workflowManager.listBuiltinFacets(),
  )

  registerMutationHandler(
    ctx,
    IPC_CHANNELS.workflowWriteProject,
    workflowWriteProjectInputSchema,
    (input) => ctx.session.writeProjectWorkflow(input.name, input.yaml, input.facetFiles),
  )

  registerMutationHandlerNoInput(ctx, IPC_CHANNELS.workflowInstallSpecDriven, () =>
    ctx.session.installSpecDrivenWorkflow(),
  )

  registerHandler(ctx, IPC_CHANNELS.workflowValidate, (_event, raw) => {
    const input = parseIpcInput(workflowValidateInputSchema, raw, IPC_CHANNELS.workflowValidate)
    return ctx.session.workflowManager.validate(input.nameOrPath, input.yaml)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowPickImportYaml, async () => {
    const win = ctx.getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, WORKFLOW_IMPORT_YAML_DIALOG)
      : await dialog.showOpenDialog(WORKFLOW_IMPORT_YAML_DIALOG)
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }
    const filePath = result.filePaths[0]
    const yaml = await readFile(filePath, 'utf8')
    return { canceled: false as const, path: filePath, yaml }
  })

  registerHandler(ctx, IPC_CHANNELS.workflowDraftSave, async (_event, raw) => {
    const input = parseIpcInput(workflowDraftSaveInputSchema, raw, IPC_CHANNELS.workflowDraftSave)
    const workspacePath = ctx.session.workspacePath
    if (!workspacePath) throw new Error('workspace not open')
    await saveWorkflowDraft(workspacePath, input.name, input.yaml)
  })

  registerHandler(ctx, IPC_CHANNELS.workflowDraftLoad, async (_event, raw) => {
    const input = parseIpcInput(workflowDraftLoadInputSchema, raw, IPC_CHANNELS.workflowDraftLoad)
    const workspacePath = ctx.session.workspacePath
    if (!workspacePath) return { yaml: null }
    const yaml = await loadWorkflowDraft(workspacePath, input.name)
    return { yaml }
  })

  registerHandler(ctx, IPC_CHANNELS.workflowDraftDelete, async (_event, raw) => {
    const input = parseIpcInput(
      workflowDraftDeleteInputSchema,
      raw,
      IPC_CHANNELS.workflowDraftDelete,
    )
    const workspacePath = ctx.session.workspacePath
    if (!workspacePath) return
    await deleteWorkflowDraft(workspacePath, input.name)
  })
}
