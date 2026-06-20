import type { EnqueueTaskInput, UiConfig } from '@planetz/shared'
import {
  ESTABLISHED_DECISIONS_FACET_KEY,
  ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES,
  ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES,
} from '@planetz/shared'
import { escapeRegExp } from '../lib/escape-reg-exp.js'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { IntentLedgerRecord } from '../storage/sqlite/repositories/intent-ledger-repository.js'
import { writeProjectFacet } from '../takt/facet-resolver.js'

/** Collapse newlines so decision statements are safe as markdown headings. */
function statementHeading(statement: string): string {
  return statement.replace(/\r?\n+/g, ' ').trim()
}

function appendDecisionSection(
  lines: string[],
  heading: string,
  entries: IntentLedgerRecord[],
): void {
  if (entries.length === 0) return
  lines.push(`## ${heading}`, '')
  for (const entry of entries) {
    lines.push(`### ${statementHeading(entry.statement)}`)
    lines.push(`- **Authority**: ${entry.authority}`)
    if (entry.scopeHint) {
      lines.push(`- **Scope**: ${entry.scopeHint}`)
    }
    if (entry.sourceDoc) {
      lines.push(`- **Source**: ${entry.sourceDoc}`)
    }
    if (entry.satisfies?.length) {
      lines.push(`- **Satisfies**: ${entry.satisfies.join(', ')}`)
    }
    if (entry.deviates?.length) {
      lines.push(`- **Deviates**: ${entry.deviates.join(', ')}`)
    }
    lines.push('')
  }
}

export function formatEstablishedDecisionsMarkdown(entries: IntentLedgerRecord[]): string {
  const lines = [
    '# Established decisions',
    '',
    'Project-specific decisions from the intent ledger.',
    'Treat REVERSING a ratified decision as an explicit change requiring documentation.',
    'Documented (unratified) entries are provisional; reconcile conflicts via ASSUMED or user confirmation.',
    '',
  ]
  if (entries.length === 0) {
    lines.push('_No established decisions yet._', '')
    return lines.join('\n')
  }
  const ratified = entries.filter((entry) => entry.authority === 'ratified')
  const unratified = entries.filter(
    (entry) => entry.authority === 'required' || entry.authority === 'designed',
  )
  appendDecisionSection(lines, 'Ratified decisions', ratified)
  appendDecisionSection(lines, 'Documented decisions (unratified)', unratified)
  return lines.join('\n')
}

export function matchesTaskScope(entry: IntentLedgerRecord, taskText: string): boolean {
  const hint = entry.scopeHint?.trim()
  if (!hint) return true
  const pattern = new RegExp(`\\b${escapeRegExp(hint)}\\b`, 'i')
  return pattern.test(taskText)
}

function applySupplyCaps(entries: IntentLedgerRecord[]): IntentLedgerRecord[] {
  let unscopedKept = 0
  const cappedUnscoped = entries.filter((entry) => {
    if (entry.scopeHint?.trim()) return true
    unscopedKept += 1
    return unscopedKept <= ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES
  })
  return cappedUnscoped.slice(0, ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES)
}

export function filterSupplyEntriesForTask(
  entries: IntentLedgerRecord[],
  input: Pick<EnqueueTaskInput, 'title' | 'body'>,
): IntentLedgerRecord[] {
  const taskText = [input.title, input.body].filter(Boolean).join('\n')
  const scoped = entries.filter((entry) => matchesTaskScope(entry, taskText))
  return applySupplyCaps(scoped)
}

export class EstablishedDecisionsWriter {
  constructor(private readonly store: IntentLedgerStore) {}

  async regenerateForTask(
    workspacePath: string,
    config: UiConfig,
    paths: SidecarPaths,
    input: Pick<EnqueueTaskInput, 'title' | 'body'>,
  ): Promise<string[]> {
    const supply = await this.store.listSupply(paths)
    const matched = filterSupplyEntriesForTask(supply, input)
    const content = formatEstablishedDecisionsMarkdown(matched)
    await writeProjectFacet(
      workspacePath,
      config,
      'knowledge',
      ESTABLISHED_DECISIONS_FACET_KEY,
      content,
    )
    return matched.map((entry) => entry.id)
  }
}
