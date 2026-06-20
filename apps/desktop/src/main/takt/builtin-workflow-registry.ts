import { type Dirent, existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  type BuiltinWorkflowTierMeta,
  getBuiltinWorkflowTierMeta,
  type WorkflowSummary,
} from '@planetz/shared'
import { parse as parseYaml } from 'yaml'
import {
  workflowFormFieldsFromYaml,
  workflowStepSummaryFields,
} from '../lib/workflow-yaml-utils.js'
import {
  PLANETZ_FALLBACK_BUILTIN_META,
  PLANETZ_FALLBACK_BUILTIN_NAMES,
} from './builtin-workflow-yaml.js'
import { candidateBundledTaktRoots } from './exec-cli.js'

const DEFAULT_BUILTIN_LANGUAGES = ['en', 'ja'] as const
const FALLBACK_NAME_SET = new Set<string>(PLANETZ_FALLBACK_BUILTIN_NAMES)

export interface BuiltinWorkflowCatalog {
  names: string[]
  summaries: WorkflowSummary[]
  yamlByName: Map<string, string>
  categoryOrder: string[]
}

let catalogCache: BuiltinWorkflowCatalog | null = null
let loadPromise: Promise<BuiltinWorkflowCatalog> | null = null
let catalogGeneration = 0

function extractDescription(yaml: string): string | undefined {
  const match = yaml.match(/^\s*description\s*:\s*(.+)$/m)
  if (!match) return undefined
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

function summaryFromBuiltin(
  name: string,
  description: string | undefined,
  yaml: string,
  categories?: string[],
): WorkflowSummary {
  const { steps, stepNames, agentRoles } = workflowStepSummaryFields(yaml)
  const { formEditable, formMode } = workflowFormFieldsFromYaml(yaml)
  return {
    name,
    source: 'builtin',
    description,
    stepNames,
    agentRoles,
    steps,
    isOverridden: false,
    diagnostics: [],
    formEditable,
    formMode,
    categories: categories && categories.length > 0 ? categories : undefined,
  }
}

function bundledCategoriesPath(root: string, language: string): string {
  return join(root, 'builtins', language, 'workflow-categories.yaml')
}

function parseWorkflowCategoriesFile(text: string): {
  order: string[]
  byWorkflow: Map<string, string[]>
} {
  const parsed = parseYaml(text) as {
    workflow_categories?: Record<string, { workflows?: string[] }>
  }
  const order: string[] = []
  const byWorkflow = new Map<string, string[]>()
  const groups = parsed.workflow_categories ?? {}
  for (const [categoryName, group] of Object.entries(groups)) {
    order.push(categoryName)
    for (const workflowName of group.workflows ?? []) {
      const existing = byWorkflow.get(workflowName) ?? []
      if (!existing.includes(categoryName)) {
        existing.push(categoryName)
      }
      byWorkflow.set(workflowName, existing)
    }
  }
  return { order, byWorkflow }
}

async function readBundledWorkflowCategories(): Promise<{
  order: string[]
  byWorkflow: Map<string, string[]>
}> {
  for (const root of candidateBundledTaktRoots()) {
    for (const lang of DEFAULT_BUILTIN_LANGUAGES) {
      const path = bundledCategoriesPath(root, lang)
      if (!existsSync(path)) continue
      try {
        const text = await readFile(path, 'utf8')
        return parseWorkflowCategoriesFile(text)
      } catch {}
    }
  }
  return { order: [], byWorkflow: new Map() }
}

async function scanBundledWorkflows(): Promise<
  Map<string, { yaml: string; description?: string }>
> {
  const byName = new Map<string, { yaml: string; description?: string }>()
  for (const root of candidateBundledTaktRoots()) {
    for (const lang of DEFAULT_BUILTIN_LANGUAGES) {
      const dir = join(root, 'builtins', lang, 'workflows')
      let entries: Dirent[]
      try {
        entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!/\.(yaml|yml)$/i.test(entry.name)) continue
        const name = basename(entry.name).replace(/\.(yaml|yml)$/i, '')
        if (FALLBACK_NAME_SET.has(name)) continue
        if (byName.has(name)) continue
        const yaml = await readFile(join(dir, entry.name), 'utf8')
        byName.set(name, { yaml, description: extractDescription(yaml) })
      }
    }
  }
  return byName
}

async function buildCatalog(): Promise<BuiltinWorkflowCatalog> {
  const [scanned, categories] = await Promise.all([
    scanBundledWorkflows(),
    readBundledWorkflowCategories(),
  ])
  const yamlByName = new Map<string, string>()
  const summaries: WorkflowSummary[] = []

  for (const [name, { yaml, description }] of scanned) {
    yamlByName.set(name, yaml)
    summaries.push(summaryFromBuiltin(name, description, yaml, categories.byWorkflow.get(name)))
  }

  for (const name of PLANETZ_FALLBACK_BUILTIN_NAMES) {
    const meta = PLANETZ_FALLBACK_BUILTIN_META[name]
    yamlByName.set(name, meta.yaml)
    summaries.push(
      summaryFromBuiltin(name, meta.description, meta.yaml, categories.byWorkflow.get(name)),
    )
  }

  summaries.sort((a, b) => a.name.localeCompare(b.name))
  return {
    names: summaries.map((summary) => summary.name),
    summaries,
    yamlByName,
    categoryOrder: categories.order,
  }
}

export function invalidateBuiltinWorkflowCatalog(): void {
  catalogCache = null
  loadPromise = null
  catalogGeneration += 1
}

export async function loadBuiltinWorkflowCatalog(): Promise<BuiltinWorkflowCatalog> {
  if (catalogCache) return catalogCache
  const generation = catalogGeneration
  if (!loadPromise) {
    loadPromise = buildCatalog().then((catalog) => {
      if (generation === catalogGeneration) {
        catalogCache = catalog
      }
      return catalog
    })
  }
  const catalog = await loadPromise
  if (generation !== catalogGeneration || !catalogCache) {
    loadPromise = null
    return loadBuiltinWorkflowCatalog()
  }
  return catalog
}

export async function ensureBuiltinWorkflowCatalogLoaded(): Promise<void> {
  await loadBuiltinWorkflowCatalog()
}

function requireCatalog(): BuiltinWorkflowCatalog {
  if (!catalogCache) {
    throw new Error(
      'Builtin workflow catalog not loaded; call ensureBuiltinWorkflowCatalogLoaded() first',
    )
  }
  return catalogCache
}

export function listBuiltinWorkflowNames(): string[] {
  return [...requireCatalog().names]
}

export function readBuiltinWorkflowYaml(name: string): string | undefined {
  return requireCatalog().yamlByName.get(name)
}

export function listBuiltinWorkflowSummaries(): WorkflowSummary[] {
  return requireCatalog().summaries.map((summary) => ({ ...summary }))
}

export function getBuiltinWorkflowCategoryOrder(): readonly string[] {
  return requireCatalog().categoryOrder
}

/**
 * Planetz tier overlay for the loaded builtin workflows. Tier metadata is kept separate
 * from {@link WorkflowSummary} (design §15.1) and resolved from a single source (§15.2).
 */
export function listBuiltinWorkflowTierMeta(): BuiltinWorkflowTierMeta[] {
  return requireCatalog().names.map((name) => getBuiltinWorkflowTierMeta(name))
}
