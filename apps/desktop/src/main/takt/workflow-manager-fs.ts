import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { UiConfig, WorkflowDiagnostic, WorkflowSource, WorkflowSummary } from '@planetz/shared'
import {
  orbitFacetsPath,
  orbitTaktGlobalWorkflowsPath,
  orbitWorkflowsPath,
  planetzWorkflowRelPath,
} from '@planetz/shared'
import { resolveDoctorInlineYaml, runWorkflowDoctor } from '../lib/workflow-doctor-runner.js'
import {
  validateYamlLocally,
  workflowError,
  workflowFormFieldsFromYaml,
  workflowStepSummaryFields,
} from '../lib/workflow-yaml-utils.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  listBuiltinWorkflowNames,
  listBuiltinWorkflowSummaries,
  readBuiltinWorkflowYaml,
} from './builtin-workflow-registry.js'
import {
  type BuiltinFacetCatalog,
  type FacetReadResult,
  listBuiltinFacetCatalog,
  readFacetsAtManagedPaths,
} from './facet-resolver.js'

const LIST_CACHE_TTL_MS = 5_000

interface WorkflowMatch {
  name: string
  source: WorkflowSource
  path?: string
}

export class TaktWorkflowManagerFs {
  private listCache: { fetchedAt: number; items: WorkflowSummary[] } | null = null

  constructor(
    private readonly workspacePath: string,
    private readonly config: UiConfig,
  ) {}

  async list(): Promise<WorkflowSummary[]> {
    const now = Date.now()
    if (this.listCache && now - this.listCache.fetchedAt < LIST_CACHE_TTL_MS) {
      return this.listCache.items
    }
    await ensureBuiltinWorkflowCatalogLoaded()
    const canonical = await this.scanDir(orbitWorkflowsPath(this.workspacePath), 'project')
    const projectNames = new Set(canonical.map((w) => w.name))
    const names = new Set(projectNames)
    const builtinNames = new Set(listBuiltinWorkflowNames())
    const builtin = listBuiltinWorkflowSummaries().map((w) => ({
      ...w,
      isOverridden: names.has(w.name),
      formEditable: w.formEditable ?? true,
    }))
    const items = [
      ...canonical.map((w) => ({
        ...w,
        isOverridden: builtinNames.has(w.name),
      })),
      ...builtin.filter((b) => !names.has(b.name)),
    ]
    this.listCache = { fetchedAt: now, items }
    return items
  }

  async read(
    nameOrPath: string,
    preferredSource?: WorkflowSource,
  ): Promise<{
    source: WorkflowSource
    path?: string
    yaml: string
  }> {
    await ensureBuiltinWorkflowCatalogLoaded()
    const match = await this.resolveMatch(nameOrPath, preferredSource)
    if (!match) {
      throw workflowError('cli_failed', `workflow not found: ${nameOrPath}`)
    }

    if (match.path) {
      const yaml = await this.readYamlAtPath(match.path)
      return { source: match.source, path: match.path, yaml }
    }

    const builtinYaml = readBuiltinWorkflowYaml(match.name)
    if (builtinYaml) {
      return { source: 'builtin', yaml: builtinYaml }
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
    const dir = orbitWorkflowsPath(this.workspacePath)
    await mkdir(dir, { recursive: true })
    const path = join(dir, `${trimmed}.yaml`)
    const rel = planetzWorkflowRelPath(trimmed)
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
    await writeFile(path, yaml, 'utf8')
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
    return { path: rel }
  }

  async readFacets(managedPaths: string[]): Promise<FacetReadResult[]> {
    return readFacetsAtManagedPaths(this.workspacePath, this.config, managedPaths, {
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
    const doctor = await runWorkflowDoctor(
      this.config,
      this.workspacePath,
      nameOrPath,
      resolveDoctorInlineYaml(text, yaml),
      {
        inlineYamlBaseDir: join(this.workspacePath, this.config.workflowsDir),
        doctorFacetsDir: join(this.workspacePath, this.config.facetsDir),
        fallbackFacetsDir: orbitFacetsPath(this.workspacePath),
      },
    )
    return [...local, ...doctor]
  }

  private workflowBaseName(nameOrPath: string): string {
    const base = basename(nameOrPath)
    return base.replace(/\.(yaml|yml)$/i, '') || nameOrPath
  }

  private async readYamlAtPath(path: string): Promise<string> {
    const projectAbs = join(this.workspacePath, path)
    if (await this.fileExists(projectAbs)) {
      return readFile(projectAbs, 'utf8')
    }
    if (await this.fileExists(path)) {
      return readFile(path, 'utf8')
    }
    throw workflowError('cli_failed', `workflow file not found: ${path}`)
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  private async resolveMatch(
    nameOrPath: string,
    preferredSource?: WorkflowSource,
  ): Promise<WorkflowMatch | null> {
    const name = this.workflowBaseName(nameOrPath)

    if (preferredSource === 'builtin') {
      await ensureBuiltinWorkflowCatalogLoaded()
      return readBuiltinWorkflowYaml(name) ? { name, source: 'builtin' } : null
    }

    const canonicalAbs = join(orbitWorkflowsPath(this.workspacePath), `${name}.yaml`)
    const globalAbs = join(orbitTaktGlobalWorkflowsPath(this.workspacePath), `${name}.yaml`)

    if (preferredSource === 'project') {
      if (await this.fileExists(canonicalAbs)) {
        return { name, source: 'project', path: planetzWorkflowRelPath(name) }
      }
      return null
    }

    if (preferredSource === 'user') {
      if (await this.fileExists(globalAbs)) {
        return { name, source: 'user', path: globalAbs }
      }
      return null
    }

    if (await this.fileExists(canonicalAbs)) {
      return { name, source: 'project', path: planetzWorkflowRelPath(name) }
    }
    if (await this.fileExists(globalAbs)) {
      return { name, source: 'user', path: globalAbs }
    }
    await ensureBuiltinWorkflowCatalogLoaded()
    if (readBuiltinWorkflowYaml(name)) {
      return { name, source: 'builtin' }
    }

    const byPath = nameOrPath.includes('/') ? nameOrPath : null
    if (byPath && (await this.fileExists(join(this.workspacePath, byPath)))) {
      return { name, source: 'project', path: byPath.replace(/\\/g, '/') }
    }

    return null
  }

  private async scanDir(dir: string, source: WorkflowSource): Promise<WorkflowSummary[]> {
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }
    const summaries: WorkflowSummary[] = []
    for (const file of files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
      const name = basename(file).replace(/\.(yaml|yml)$/, '')
      const path =
        source === 'project'
          ? join(this.config.workflowsDir, file).replace(/\\/g, '/')
          : join(dir, file)
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
        source,
        path,
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
