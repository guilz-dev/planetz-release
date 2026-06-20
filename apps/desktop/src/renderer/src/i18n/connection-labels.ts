import type { ConnectionState, UiLanguage } from '@planetz/shared'
import { translate } from './catalog.js'

export function formatLocalizedConnectionLabels(
  locale: UiLanguage,
  connection: ConnectionState,
): { cli: string; watch: string } {
  const cli =
    connection.cli === 'ok'
      ? translate(locale, 'connection.cliOk')
      : connection.cli === 'ng'
        ? translate(locale, 'connection.cliError')
        : translate(locale, 'connection.cliUnknown')
  const watch =
    connection.watch === 'running'
      ? translate(locale, 'connection.watchOn')
      : connection.watch === 'stopped'
        ? translate(locale, 'connection.watchOff')
        : translate(locale, 'connection.watchUnknown')
  return { cli, watch }
}
