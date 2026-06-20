import type { UiLanguage } from '@planetz/shared'
import { createContext } from 'react'
import type { I18nKey } from './catalog.js'
import type { MessageParams } from './message-tree.js'

export type TranslateFn = (key: I18nKey, params?: MessageParams) => string

export type I18nContextValue = {
  locale: UiLanguage
  t: TranslateFn
}

/** Stable context instance — keep in a module that only exports non-React-component values. */
export const I18nContext = createContext<I18nContextValue | null>(null)
