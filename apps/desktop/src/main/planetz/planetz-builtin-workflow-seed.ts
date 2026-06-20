import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHAT_INVESTIGATION_WORKFLOW_NAME,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  PRODUCT_DEFAULT_WORKFLOW_NAME,
} from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import {
  BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML,
  BUILTIN_DEFAULT_WORKFLOW_YAML,
  BUILTIN_MINIMAL_WORKFLOW_YAML,
  PLANETZ_FALLBACK_BUILTIN_NAMES,
  type PlanetzFallbackBuiltinName,
} from '../takt/builtin-workflow-yaml.js'

/** Product open bootstrap vs runtime projection (includes ollama-chat). */
export type BuiltinWorkflowSeedScope = 'product' | 'runtime-fallback'

export interface EnsureBuiltinWorkflowFilesResult {
  workflowsCreated: number
}

const PRODUCT_WORKFLOW_NAMES = [
  PRODUCT_DEFAULT_WORKFLOW_NAME,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  CHAT_INVESTIGATION_WORKFLOW_NAME,
] as const

type ProductWorkflowName = (typeof PRODUCT_WORKFLOW_NAMES)[number]

const PRODUCT_SEED_YAML: Record<ProductWorkflowName, string> = {
  [PRODUCT_DEFAULT_WORKFLOW_NAME]: BUILTIN_DEFAULT_WORKFLOW_YAML,
  [COMPOSER_DEFAULT_WORKFLOW_NAME]: BUILTIN_MINIMAL_WORKFLOW_YAML,
  [CHAT_INVESTIGATION_WORKFLOW_NAME]: BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML,
}

function workflowNamesForScope(scope: BuiltinWorkflowSeedScope): readonly string[] {
  return scope === 'product' ? PRODUCT_WORKFLOW_NAMES : PLANETZ_FALLBACK_BUILTIN_NAMES
}

function seedYamlForWorkflow(name: string, scope: BuiltinWorkflowSeedScope): string | null {
  if (scope === 'product') {
    if (!(name in PRODUCT_SEED_YAML)) return null
    return PRODUCT_SEED_YAML[name as ProductWorkflowName]
  }
  return readBuiltinWorkflowYaml(name as PlanetzFallbackBuiltinName) ?? null
}

/**
 * Materialize missing builtin workflow YAML under `paths.planetzWorkflowsDir`.
 * Single source for workspace open bootstrap and isolated runtime projection.
 */
export async function ensureBuiltinWorkflowFiles(
  paths: SidecarPaths,
  scope: BuiltinWorkflowSeedScope,
  options?: { onWorkflowFileCreated?: () => void },
): Promise<EnsureBuiltinWorkflowFilesResult> {
  await ensureBuiltinWorkflowCatalogLoaded()
  await mkdir(paths.planetzWorkflowsDir, { recursive: true })
  let workflowsCreated = 0
  for (const name of workflowNamesForScope(scope)) {
    const target = join(paths.planetzWorkflowsDir, `${name}.yaml`)
    try {
      await access(target)
      continue
    } catch {
      // missing — seed from builtin catalog
    }
    const yaml = seedYamlForWorkflow(name, scope)
    if (!yaml) continue
    await writeFile(target, yaml, 'utf8')
    workflowsCreated += 1
    options?.onWorkflowFileCreated?.()
  }
  return { workflowsCreated }
}
