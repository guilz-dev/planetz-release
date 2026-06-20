import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  type FacetKind,
  type FacetUsageSummary,
  orbitWorkflowsPath,
  type UiConfig,
} from '@planetz/shared'
import YAML from 'yaml'

function collectTopLevelKeys(doc: Record<string, unknown>, kind: FacetKind): Set<string> {
  const keys = new Set<string>()
  const sectionKey = kind === 'reportFormats' ? 'output_contracts' : kind
  const section = doc[sectionKey]
  if (!section || typeof section !== 'object') return keys
  for (const [key, value] of Object.entries(section as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) keys.add(key)
    else if (value && typeof value === 'object') keys.add(key)
  }
  return keys
}

function countStepRefs(doc: Record<string, unknown>, kind: FacetKind, targetKey: string): number {
  const steps = doc.steps
  if (!Array.isArray(steps)) return 0
  let count = 0
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const s = step as Record<string, unknown>
    if (kind === 'personas') {
      if (s.persona === targetKey) count += 1
    } else if (kind === 'policies') {
      if (s.policy === targetKey) count += 1
    } else if (kind === 'knowledge') {
      if (s.knowledge === targetKey) count += 1
    } else if (kind === 'instructions') {
      if (s.instruction === targetKey) count += 1
    } else if (kind === 'reportFormats') {
      const oc = s.output_contracts
      if (oc && typeof oc === 'object') {
        for (const list of Object.values(oc as Record<string, unknown>)) {
          if (!Array.isArray(list)) continue
          for (const entry of list) {
            if (entry && typeof entry === 'object') {
              const fmt = (entry as { format?: unknown }).format
              if (fmt === targetKey) count += 1
            }
          }
        }
      }
    }
  }
  return count
}

export async function listFacetUsages(
  workspacePath: string,
  _config: UiConfig,
  kind: FacetKind,
  key: string,
): Promise<FacetUsageSummary> {
  const trimmedKey = key.trim()
  if (!trimmedKey) return { workflowCount: 0, stepCount: 0, workflowNames: [] }

  const workflowsDir = orbitWorkflowsPath(workspacePath)
  let entries: Dirent[]
  try {
    entries = await readdir(workflowsDir, { withFileTypes: true, encoding: 'utf8' })
  } catch {
    return { workflowCount: 0, stepCount: 0, workflowNames: [] }
  }

  let workflowCount = 0
  let stepCount = 0
  const workflowNames: string[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) continue
    const filePath = join(workflowsDir, entry.name)
    let text: string
    try {
      text = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    let doc: Record<string, unknown>
    try {
      const parsed = YAML.parse(text)
      if (!parsed || typeof parsed !== 'object') continue
      doc = parsed as Record<string, unknown>
    } catch {
      continue
    }
    const steps = countStepRefs(doc, kind, trimmedKey)
    const inTopLevel = collectTopLevelKeys(doc, kind).has(trimmedKey)
    if (steps > 0 || inTopLevel) {
      workflowCount += 1
      stepCount += steps
      const yamlName = typeof doc.name === 'string' ? doc.name.trim() : ''
      const fallbackName = basename(entry.name).replace(/\.(yaml|yml)$/i, '')
      workflowNames.push(yamlName || fallbackName)
    }
  }

  workflowNames.sort((a, b) => a.localeCompare(b))
  return { workflowCount, stepCount, workflowNames }
}
