import type { WorkflowSummary } from '@planetz/shared'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'
import { Field, Input } from '../ui/input'
import { WorkflowCatalogTabs } from './workflow-catalog-tabs.js'
import type { WorkflowCreateResult } from './workflow-create-dialog.js'
import { WorkflowCreateDialog } from './workflow-create-dialog.js'

export interface WorkflowEditorCatalogViewProps {
  workflows: WorkflowSummary[]
  workflowNameFilter: ReadonlySet<string> | null
  workflowFilterLabel: string | null
  onClearWorkflowFilter?: () => void
  onRefreshCatalogOpen: (name: string, options?: { openYaml?: boolean }) => Promise<void>
  handleCopyToProject: (name: string) => void
  openDuplicateDialog: (name: string) => void
  handleDiffVsBuiltin: (name: string) => void
  handleCreateNew: () => void
  createDialogOpen: boolean
  setCreateDialogOpen: (open: boolean) => void
  handleCreateConfirm: (result: WorkflowCreateResult) => Promise<void>
  duplicateDialogOpen: boolean
  closeDuplicateDialog: () => void
  submitDuplicateDialog: () => Promise<void>
  nameInput: string
  setNameInput: (next: string) => void
  nameDialogError: string | null
}

export function WorkflowEditorCatalogView({
  workflows,
  workflowNameFilter,
  workflowFilterLabel,
  onClearWorkflowFilter,
  onRefreshCatalogOpen,
  handleCopyToProject,
  openDuplicateDialog,
  handleDiffVsBuiltin,
  handleCreateNew,
  createDialogOpen,
  setCreateDialogOpen,
  handleCreateConfirm,
  duplicateDialogOpen,
  closeDuplicateDialog,
  submitDuplicateDialog,
  nameInput,
  setNameInput,
  nameDialogError,
}: WorkflowEditorCatalogViewProps) {
  return (
    <>
      <WorkflowCatalogTabs
        workflows={workflows}
        workflowNameFilter={workflowNameFilter}
        workflowFilterLabel={workflowFilterLabel}
        onClearWorkflowFilter={onClearWorkflowFilter}
        onOpen={(n) => void onRefreshCatalogOpen(n)}
        onOpenYaml={(n) => void onRefreshCatalogOpen(n, { openYaml: true })}
        onCopyToProject={handleCopyToProject}
        onDuplicate={openDuplicateDialog}
        onDiff={(n) => void handleDiffVsBuiltin(n)}
        onCreateNew={handleCreateNew}
      />
      <WorkflowCreateDialog
        open={createDialogOpen}
        workflows={workflows}
        onClose={() => setCreateDialogOpen(false)}
        onConfirm={handleCreateConfirm}
      />
      <Dialog
        open={duplicateDialogOpen}
        onClose={closeDuplicateDialog}
        title="Duplicate workflow"
        description="Create a project workflow from an existing workflow."
        size="sm"
        footer={
          <>
            <Button variant="ghost" type="button" onClick={closeDuplicateDialog}>
              Cancel
            </Button>
            <Button variant="primary" type="button" onClick={() => void submitDuplicateDialog()}>
              Duplicate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Field label="Workflow name (kebab-case)">
            <Input
              autoFocus
              placeholder="my-workflow"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitDuplicateDialog()
                }
              }}
            />
          </Field>
          {nameDialogError ? (
            <p className="text-xs text-[var(--color-status-failed)]">{nameDialogError}</p>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
