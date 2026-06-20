import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { resolveTaktWorkflowYaml } from '../../planetz/takt-import-sources.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  readBuiltinWorkflowYaml,
} from '../../takt/builtin-workflow-registry.js'

export type WorkflowYamlSource = 'project' | 'imported' | 'builtin'

export type WorkflowYamlResolveResult = {
  yaml: string
  source: WorkflowYamlSource
}

export type WorkflowYamlResolver = (name: string) => Promise<WorkflowYamlResolveResult | null>

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function workflowBaseName(nameOrPath: string): string {
  const base = nameOrPath.replace(/\\/g, '/').split('/').pop() ?? nameOrPath
  return base.replace(/\.(yaml|yml)$/i, '')
}

/**
 * Routing-only workflow YAML resolution (design §5.2.1):
 * sidecar canonical → imported/compat → builtin.
 * Do not use PlanetzWorkflowCanonicalManager.read (different order).
 */
export async function resolveWorkflowYamlForRouting(
  name: string,
  ctx: {
    sidecarWorkflowsDir: string
    workspacePath: string
    config: UiConfig
    taktRepoPath?: string | null
    mode: 'production' | 'mock-builtin-only'
  },
): Promise<WorkflowYamlResolveResult | null> {
  const workflowName = workflowBaseName(name)
  await ensureBuiltinWorkflowCatalogLoaded()

  if (ctx.mode === 'mock-builtin-only') {
    const yaml = readBuiltinWorkflowYaml(workflowName)
    return yaml ? { yaml, source: 'builtin' } : null
  }

  const canonicalPath = join(ctx.sidecarWorkflowsDir, `${workflowName}.yaml`)
  if (await fileExists(canonicalPath)) {
    const yaml = await readFile(canonicalPath, 'utf8')
    if (yaml.trim()) return { yaml, source: 'project' }
  }

  const imported = await resolveTaktWorkflowYaml(ctx.workspacePath, ctx.config, workflowName, {
    taktRepoPath: ctx.taktRepoPath ?? undefined,
  })
  if (imported && imported.layer !== 'builtin') {
    return { yaml: imported.yaml, source: 'imported' }
  }

  const builtinYaml = readBuiltinWorkflowYaml(workflowName)
  if (builtinYaml) return { yaml: builtinYaml, source: 'builtin' }

  return null
}

export function createRoutingWorkflowResolver(ctx: {
  sidecarWorkflowsDir: string
  workspacePath: string
  config: UiConfig
  taktRepoPath?: string | null
  mode: 'production' | 'mock-builtin-only'
}): WorkflowYamlResolver {
  return (name) => resolveWorkflowYamlForRouting(name, ctx)
}
