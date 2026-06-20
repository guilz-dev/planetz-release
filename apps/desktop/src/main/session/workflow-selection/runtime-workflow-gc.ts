import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isRuntimeMaterializedWorkflowName,
  ORBIT_RUNTIME_WORKFLOWS_DIRNAME,
  RUNTIME_WORKFLOW_OVERRIDE_SUFFIX,
  type TaskViewModel,
} from '@planetz/shared'
import { taktGlobalWorkflowsDir } from '../../planetz/takt-runtime-adapter.js'
import type { SidecarPaths } from '../../sidecar/sidecar-paths.js'

const RUNTIME_OVERRIDE_FILE_PATTERN = new RegExp(
  `^.+${RUNTIME_WORKFLOW_OVERRIDE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-rt-[0-9a-f]{8})?\\.yaml$`,
)

export function collectReferencedRuntimeWorkflowNames(tasks: TaskViewModel[]): Set<string> {
  const referenced = new Set<string>()
  for (const task of tasks) {
    const workflow = task.workflow?.trim()
    if (workflow && isRuntimeMaterializedWorkflowName(workflow)) {
      referenced.add(workflow)
    }
  }
  return referenced
}

async function listRuntimeOverrideEntries(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    return entries.filter((entry) => RUNTIME_OVERRIDE_FILE_PATTERN.test(entry))
  } catch {
    return []
  }
}

async function tryUnlink(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function collectOrphanWorkflowNames(
  dir: string,
  referenced: ReadonlySet<string>,
  orphanNames: Set<string>,
): Promise<void> {
  for (const entry of await listRuntimeOverrideEntries(dir)) {
    const workflowName = entry.replace(/\.yaml$/, '')
    if (!referenced.has(workflowName)) {
      orphanNames.add(workflowName)
    }
  }
}

async function removeOrphanWorkflowFiles(
  paths: SidecarPaths,
  workflowName: string,
): Promise<boolean> {
  const entry = `${workflowName}.yaml`
  const runtimePath = join(paths.root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME, entry)
  const taktGlobalPath = join(taktGlobalWorkflowsDir(paths), entry)
  const removedSidecar = await tryUnlink(runtimePath)
  const removedMirror = await tryUnlink(taktGlobalPath)
  return removedSidecar || removedMirror
}

export async function gcOrphanRuntimeWorkflowFiles(
  paths: SidecarPaths,
  referenced: ReadonlySet<string>,
): Promise<number> {
  const orphanNames = new Set<string>()
  await collectOrphanWorkflowNames(
    join(paths.root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME),
    referenced,
    orphanNames,
  )
  await collectOrphanWorkflowNames(taktGlobalWorkflowsDir(paths), referenced, orphanNames)

  let removed = 0
  for (const workflowName of orphanNames) {
    if (await removeOrphanWorkflowFiles(paths, workflowName)) {
      removed += 1
    }
  }
  return removed
}
