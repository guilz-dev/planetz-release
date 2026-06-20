export type TaktPathAccessKind =
  | 'home_dot_takt'
  | 'project_dot_takt'
  | 'orbit_takt_global'
  | 'orbit_workflows'

export interface TaktPathAccessEvent {
  kind: TaktPathAccessKind
  path: string
  caller: string
}

const accessLog: TaktPathAccessEvent[] = []

/** Records a filesystem path access for orbit/takt separation audits (tests and dev). */
export function recordTaktPathAccess(kind: TaktPathAccessKind, path: string, caller: string): void {
  accessLog.push({ kind, path, caller })
  if (process.env.PLANETZ_TAKT_PATH_TELEMETRY === '1') {
    console.info(`[takt-path] ${kind} ${path} (${caller})`)
  }
}

export function getTaktPathAccessLog(): readonly TaktPathAccessEvent[] {
  return accessLog
}

export function clearTaktPathAccessLog(): void {
  accessLog.length = 0
}

export function countTaktPathAccess(kind: TaktPathAccessKind): number {
  return accessLog.filter((e) => e.kind === kind).length
}
