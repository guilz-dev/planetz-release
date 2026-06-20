import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/app-store.js'
import { type I18nKey, translate } from './catalog.js'
import { I18nContext } from './i18n-context.js'
import type { MessageParams } from './message-tree.js'

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useAppStore((s) => s.uiLanguage)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: I18nKey, params?: MessageParams) => translate(locale, key, params),
    [locale],
  )

  const value = useMemo(() => ({ locale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
