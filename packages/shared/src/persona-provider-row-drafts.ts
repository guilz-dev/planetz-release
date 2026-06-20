import type { PersonaProviderRow, PersonaStructuredDraft } from './persona-providers-form.js'

export type { PersonaStructuredDraft } from './persona-providers-form.js'

/** Snapshot active row fields into the draft for the current mode. */
export function snapshotPersonaRowDraft(row: PersonaProviderRow): PersonaProviderRow {
  if (row.mode === 'shorthand') {
    return {
      ...row,
      shorthandDraft: row.shorthand,
    }
  }
  const structured: PersonaStructuredDraft = {
    provider: row.provider,
    model: row.model,
    type: row.type,
    effort: row.effort,
    ...(row.providerOptions ? { providerOptions: { ...row.providerOptions } } : {}),
  }
  return {
    ...row,
    structuredDraft: structured,
  }
}

/**
 * Switch entry type using stored drafts. Snapshots the outgoing mode before applying.
 */
export function applyPersonaRowModeSwitch(
  row: PersonaProviderRow,
  nextMode: PersonaProviderRow['mode'],
): PersonaProviderRow {
  const snapshotted = snapshotPersonaRowDraft(row)
  if (nextMode === 'shorthand') {
    return {
      ...snapshotted,
      mode: 'shorthand',
      shorthand: snapshotted.shorthandDraft ?? snapshotted.shorthand,
    }
  }
  const draft = snapshotted.structuredDraft
  return {
    ...snapshotted,
    mode: 'structured',
    provider: draft?.provider ?? snapshotted.provider,
    model: draft?.model ?? snapshotted.model,
    type: draft?.type ?? snapshotted.type,
    effort: draft?.effort ?? snapshotted.effort,
    providerOptions: draft?.providerOptions ?? snapshotted.providerOptions,
  }
}
