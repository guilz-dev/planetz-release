import type {
  StepActivityEntry,
  TaskExecutionActivityEntry,
  TaskExecutionActivityKind,
} from './types.js'

export function stepActivityKindToTaskExecutionKind(
  kind: StepActivityEntry['kind'],
): TaskExecutionActivityKind {
  if (kind === 'message') return 'text'
  if (kind === 'log' || kind === 'read' || kind === 'edit' || kind === 'tool') return 'status'
  if (kind === 'error') return 'error'
  return kind
}

export function stepActivityToTaskExecutionEntry(
  entry: StepActivityEntry,
  stepName: string,
): TaskExecutionActivityEntry {
  return {
    at: entry.at,
    kind: stepActivityKindToTaskExecutionKind(entry.kind),
    text: entry.text,
    ...(entry.level ? { level: entry.level } : {}),
    stepName,
  }
}
