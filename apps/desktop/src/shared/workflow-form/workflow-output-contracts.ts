import { parse as parseYaml } from 'yaml'

/** Canonical Orbit output_contracts group key (schema accepts `report` only). */
export const OUTPUT_CONTRACT_REPORT_GROUP = 'report'

/** Legacy Planetz group key; still parsed for backward compatibility. */
export const OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP = 'markdown'

export interface OutputContractRow {
  group: string
  format: string
  name?: string
}

export interface FlatOutputContract extends OutputContractRow {
  stepName: string
}

export function parseOutputContracts(raw: Record<string, unknown>): OutputContractRow[] {
  const oc = raw.output_contracts
  if (!oc || typeof oc !== 'object' || Array.isArray(oc)) return []
  const rows: OutputContractRow[] = []
  for (const [group, list] of Object.entries(oc as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as { format?: unknown; name?: unknown }
      if (typeof e.format === 'string') {
        rows.push({
          group,
          format: e.format,
          name: typeof e.name === 'string' ? e.name : undefined,
        })
      }
    }
  }
  return rows
}

export function flattenWorkflowOutputContracts(yaml: string): FlatOutputContract[] {
  let doc: unknown
  try {
    doc = parseYaml(yaml)
  } catch {
    return []
  }
  if (!doc || typeof doc !== 'object') return []
  const root = doc as Record<string, unknown>
  const steps = root.steps
  if (!Array.isArray(steps)) return []
  const flat: FlatOutputContract[] = []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const stepRecord = step as Record<string, unknown>
    const stepName = typeof stepRecord.name === 'string' ? stepRecord.name : ''
    if (!stepName) continue
    for (const row of parseOutputContracts(stepRecord)) {
      flat.push({ ...row, stepName })
    }
  }
  return flat
}

/** True when the step declares at least one report output contract (report or legacy markdown group). */
export function stepHasReportOutputContracts(raw: Record<string, unknown>): boolean {
  const oc = raw.output_contracts
  if (!oc || typeof oc !== 'object' || Array.isArray(oc)) return false
  const record = oc as Record<string, unknown>
  for (const group of [OUTPUT_CONTRACT_REPORT_GROUP, OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP]) {
    const list = record[group]
    if (Array.isArray(list) && list.length > 0) return true
  }
  return false
}

export function contractCandidateFileNames(contract: OutputContractRow): string[] {
  const names = new Set<string>()
  if (contract.name?.trim()) {
    const base = contract.name.trim()
    names.add(base)
    if (!base.endsWith('.md')) names.add(`${base}.md`)
  }
  names.add(`${contract.format}.md`)
  names.add(contract.format)
  return [...names]
}
