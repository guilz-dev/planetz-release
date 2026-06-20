import type { PanelId, UiLanguage } from '@planetz/shared'
import type { MessageKey, MessageParams } from './message-tree.js'
import { resolveMessage } from './message-tree.js'
import { enMessages } from './messages/en.js'
import { jaMessages } from './messages/ja.js'

const catalogs = {
  en: enMessages,
  ja: jaMessages,
} as const

export type I18nKey = MessageKey<typeof enMessages>

export function translate(locale: UiLanguage, key: I18nKey, params?: MessageParams): string {
  return resolveMessage(catalogs[locale], key, params)
}

type PanelTitleKey = Exclude<
  keyof typeof enMessages.panels,
  | 'running'
  | 'failure'
  | 'pending'
  | 'task'
  | 'result'
  | 'detailBack'
  | 'detailBackAria'
  | 'detailEmpty'
  | 'detailExpand'
  | 'detailExpandAria'
  | 'detailCollapseAria'
  | 'noAgents'
  | 'outcome'
>

const PANEL_MESSAGE_KEYS: Record<PanelId, PanelTitleKey> = {
  agents: 'agents',
  tasks: 'tasks',
  retries: 'retries',
  results: 'results',
  detail: 'detail',
  overview: 'overview',
  composer: 'composer',
}

export function panelTitle(locale: UiLanguage, panel: PanelId): string {
  const key = PANEL_MESSAGE_KEYS[panel]
  return catalogs[locale].panels[key]
}
