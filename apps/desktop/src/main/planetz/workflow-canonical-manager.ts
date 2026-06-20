import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { UiConfig, WorkflowDiagnostic, WorkflowSource, WorkflowSummary } from '@planetz/shared'
import { orbitFacetsPath, planetzWorkflowRelPath } from '@planetz/shared'
import { resolveDoctorInlineYaml, runWorkflowDoctor } from '../lib/workflow-doctor-runner.js'
import {
  validateYamlLocally,
  workflowError,
  workflowFormFieldsFromYaml,
  workflowStepSummaryFields,
} from '../lib/workflow-yaml-utils.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  listBuiltinWorkflowNames,
  listBuiltinWorkflowSummaries,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import {
  type BuiltinFacetCatalog,
  type FacetReadResult,
  listBuiltinFacetCatalog,
  readFacetsAtManagedPaths,
} from '../takt/facet-resolver.js'
import { resolveTaktWorkflowYaml } from './takt-import-sources.js'
import type { WorkflowRoutingCatalogStore } from './workflow-routing-catalog.js'
import { mergeNewWorkflowsIntoRoutingCatalog } from './workflow-routing-catalog-merge.js'
export class PlanetzWorkflowCanonicalManager {
  private listCache: { fetchedAt: number; items: WorkflowSummary[] } | null = null

  invalidateListCache(): void {
    this.listCache = null
  }

  /** `.planetz/orbit/workflows` only — no project compat / builtin fallback (runtime execution profile). */
  async readCanonicalYaml(nameOrPath: string): Promise<string | null> {
    const name = this.workflowBaseName(nameOrPath)
    const abs = join(this.sidecarPaths.planetzWorkflowsDir, `${name}.yaml`)
    try {
      return await readFile(abs, 'utf8')
    } catch {
      return null
    }
  }

  constructor(
    private readonly workspacePath: string,
    private readonly config: UiConfig,
    private readonly sidecarPaths: SidecarPaths,
    private readonly taktExecutionPath: string | null = null,
    private readonly routingCatalogStore: WorkflowRoutingCatalogStore | null = null,
  ) {}

  private taktCwd(): string {
    return this.taktExecutionPath ?? this.workspacePath
  }

  async list(): Promise<WorkflowSummary[]> {
    const now = Date.now()
    if (this.listCache && now - this.listCache.fetchedAt < 5_000) {
      return this.listCache.items
    }
    await ensureBuiltinWorkflowCatalogLoaded()
    const canonical = await this.scanCanonicalDir()
    const canonicalNames = new Set(canonical.map((w) => w.name))
    const builtinNames = new Set(listBuiltinWorkflowNames())
    const builtin = listBuiltinWorkflowSummaries()
      .map((w) => ({
        ...w,
        isOverridden: canonicalNames.has(w.name),
        formEditable: w.formEditable ?? true,
      }))
      .filter((b) => !canonicalNames.has(b.name))
    const items = [
      ...canonical.map((w) => ({
        ...w,
        isOverridden: builtinNames.has(w.name),
      })),
      ...builtin,
    ]
    this.listCache = { fetchedAt: now, items }
    return items
  }

  async read(
    nameOrPath: string,
    preferredSource?: WorkflowSource,
  ): Promise<{ source: WorkflowSource; path?: string; yaml: string }> {
    await ensureBuiltinWorkflowCatalogLoaded()
    const name = this.workflowBaseName(nameOrPath)
    if (preferredSource === 'builtin') {
      const yaml = readBuiltinWorkflowYaml(name)
      if (!yaml) throw workflowError('cli_failed', `workflow not found: ${nameOrPath}`)
      return { source: 'builtin', yaml }
    }

    const rel = planetzWorkflowRelPath(name)
    const abs = join(this.sidecarPaths.planetzWorkflowsDir, `${name}.yaml`)
    if (await this.fileExists(abs)) {
      const yaml = await readFile(abs, 'utf8')
      return { source: 'project', path: rel, yaml }
    }

    if (preferredSource === 'project') {
      throw workflowError('cli_failed', `workflow not found: ${nameOrPath}`)
    }

    const builtinYaml = readBuiltinWorkflowYaml(name)
    if (builtinYaml) {
      return { source: 'builtin', yaml: builtinYaml }
    }

    // Fallback read for display/edit before a canonical copy exists; writes stay under sidecar root.
    const imported = await resolveTaktWorkflowYaml(this.workspacePath, this.config, name, {
      taktRepoPath: this.taktExecutionPath ?? undefined,
    })
    if (imported) {
      const source: WorkflowSource = imported.layer === 'builtin' ? 'builtin' : 'project'
      return { source, path: imported.path, yaml: imported.yaml }
    }

    throw workflowError('cli_failed', `workflow not found: ${nameOrPath}`)
  }

  async writeProject(
    name: string,
    yaml: string,
    facetFiles?: Record<string, string>,
  ): Promise<{ path: string }> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw workflowError('yaml_parse_error', 'workflow name is empty', name)
    }
    const rel = planetzWorkflowRelPath(trimmed)
    const abs = join(this.sidecarPaths.planetzWorkflowsDir, `${trimmed}.yaml`)
    const diagnostics = await this.validate(trimmed, yaml)
    const errors = diagnostics.filter((d) => d.level === 'error')
    if (errors.length > 0) {
      throw workflowError(
        errors[0].code ?? 'doctor_validation_error',
        errors[0].message,
        rel,
        diagnostics,
      )
    }
    await mkdir(this.sidecarPaths.planetzWorkflowsDir, { recursive: true })
    await writeFile(abs, yaml, 'utf8')
    if (facetFiles) {
      for (const [relativePath, content] of Object.entries(facetFiles)) {
        if (!relativePath.startsWith('facets/') || relativePath.includes('..')) {
          throw workflowError('permission_denied', `invalid facet path: ${relativePath}`)
        }
        if (!relativePath.endsWith('.md')) {
          throw workflowError('permission_denied', `facet file must end with .md: ${relativePath}`)
        }
        const facetSubPath = relativePath.replace(/^facets\//, '')
        const facetPath = join(orbitFacetsPath(this.workspacePath), facetSubPath)
        await mkdir(dirname(facetPath), { recursive: true })
        await writeFile(facetPath, content, 'utf8')
      }
    }
    this.listCache = null
    if (this.routingCatalogStore) {
      const summaries = await this.list()
      const summary = summaries.find((item) => item.name === trimmed)
      await mergeNewWorkflowsIntoRoutingCatalog(this.routingCatalogStore, [
        { name: trimmed, categories: summary?.categories, source: summary?.source },
      ]).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('[workflow-routing] failed to merge new workflow into catalog', {
          name: trimmed,
          message,
        })
      })
    }
    return { path: rel }
  }

  async readFacets(managedPaths: string[]): Promise<FacetReadResult[]> {
    return readFacetsAtManagedPaths(this.taktCwd(), this.config, managedPaths, {
      mainWorkspacePath: this.workspacePath,
    })
  }

  async listBuiltinFacets(): Promise<BuiltinFacetCatalog> {
    return listBuiltinFacetCatalog()
  }

  async validate(nameOrPath: string, yaml?: string): Promise<WorkflowDiagnostic[]> {
    const text =
      yaml ?? (await this.read(nameOrPath).catch(() => ({ yaml: '' }) as { yaml: string })).yaml
    const local = validateYamlLocally(nameOrPath, text)
    if (local.some((d) => d.level === 'error')) return local
    const taktCwd = this.taktCwd()
    const doctor = await runWorkflowDoctor(
      this.config,
      taktCwd,
      nameOrPath,
      resolveDoctorInlineYaml(text, yaml),
      {
        inlineYamlBaseDir: join(taktCwd, this.config.workflowsDir),
        doctorFacetsDir: join(taktCwd, this.config.facetsDir),
        fallbackFacetsDir: orbitFacetsPath(this.workspacePath),
      },
    )
    return [...local, ...doctor]
  }

  private workflowBaseName(nameOrPath: string): string {
    const base = basename(nameOrPath)
    return base.replace(/\.(yaml|yml)$/i, '') || nameOrPath
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  private async scanCanonicalDir(): Promise<WorkflowSummary[]> {
    const dir = this.sidecarPaths.planetzWorkflowsDir
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }
    const summaries: WorkflowSummary[] = []
    for (const file of files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
      const name = basename(file).replace(/\.(yaml|yml)$/, '')
      const rel = planetzWorkflowRelPath(name)
      let yaml = ''
      try {
        yaml = await readFile(join(dir, file), 'utf8')
      } catch {
        continue
      }
      const diagnostics = validateYamlLocally(name, yaml)
      const { steps, stepNames, agentRoles } = workflowStepSummaryFields(yaml)
      const { formEditable, formMode } = workflowFormFieldsFromYaml(yaml)
      summaries.push({
        name,
        source: 'project',
        path: rel,
        stepNames,
        agentRoles,
        steps,
        isOverridden: false,
        diagnostics,
        formEditable: formEditable && !diagnostics.some((d) => d.level === 'error'),
        formMode,
      })
    }
    return summaries
  }
}
