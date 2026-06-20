import type { ConnectionState } from './types.js'

export interface ConnectionLabels {
  cli: string
  watch: string
}

export function formatConnectionLabels(connection: ConnectionState): ConnectionLabels {
  const cli =
    connection.cli === 'ok' ? 'CLI OK' : connection.cli === 'ng' ? 'CLI error' : 'CLI unknown'
  const watch =
    connection.watch === 'running'
      ? 'watch on'
      : connection.watch === 'stopped'
        ? 'watch off'
        : 'watch —'
  return { cli, watch }
}
