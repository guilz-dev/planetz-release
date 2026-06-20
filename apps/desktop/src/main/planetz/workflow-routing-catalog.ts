import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  orbitWorkflowRoutingPath,
  ROUTING_GROUPS,
  type WorkflowRoutingCatalog,
  workflowRoutingCatalogSchema,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const EMPTY_CATALOG: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [],
}

export class WorkflowRoutingCatalogStore {
  private cached: WorkflowRoutingCatalog | null = null
  private cachedMtimeMs = 0

  constructor(private readonly workspacePath: string) {}

  routingFilePath(): string {
    return orbitWorkflowRoutingPath(this.workspacePath)
  }

  invalidate(): void {
    this.cached = null
    this.cachedMtimeMs = 0
  }

  async load(): Promise<WorkflowRoutingCatalog> {
    const path = this.routingFilePath()
    try {
      const fileStat = await stat(path)
      const mtimeMs = fileStat.mtimeMs
      if (this.cached && mtimeMs === this.cachedMtimeMs) {
        return this.cached
      }
      const text = await readFile(path, 'utf8')
      const parsed = workflowRoutingCatalogSchema.safeParse(parseYaml(text))
      if (!parsed.success) {
        console.warn('[workflow-routing] invalid catalog; using empty catalog', {
          path,
          issues: parsed.error.issues.length,
        })
        this.cached = { ...EMPTY_CATALOG }
        this.cachedMtimeMs = mtimeMs
        return this.cached
      }
      this.cached = parsed.data
      this.cachedMtimeMs = mtimeMs
      return parsed.data
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[workflow-routing] failed to read catalog; using empty catalog', {
        path,
        message,
      })
      this.cached = { ...EMPTY_CATALOG }
      this.cachedMtimeMs = 0
      return this.cached
    }
  }

  async write(catalog: WorkflowRoutingCatalog): Promise<void> {
    const path = this.routingFilePath()
    const validated = workflowRoutingCatalogSchema.parse(catalog)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, stringifyYaml(validated), 'utf8')
    this.cached = validated
    this.cachedMtimeMs = (await stat(path)).mtimeMs
  }
}
