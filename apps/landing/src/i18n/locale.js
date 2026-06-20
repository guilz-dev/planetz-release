import { I18N_ATTR_ALLOWLIST } from './i18n-dom-policy.js'
import { mantaPageMessages } from './manta-page-messages.js'
import { messages } from './messages.js'
import { sanitizeI18nHtml } from './sanitize-i18n-html.js'

const STORAGE_KEY = 'planetz-landing-locale'
export const DEFAULT_LOCALE = 'en'
const SUPPORTED = new Set(['en', 'ja'])

let currentLocale = DEFAULT_LOCALE

function isMantaSpecsPage() {
  const path = window.location.pathname
  return path.endsWith('/manta.html') || path.endsWith('/manta')
}

/** @param {string} locale */
function getMessageTree(locale) {
  if (!isMantaSpecsPage()) return messages[locale]
  const page = mantaPageMessages[locale]
  return { ...messages[locale], ...page, meta: page.meta }
}

/** @param {string} locale */
export function isSupportedLocale(locale) {
  return SUPPORTED.has(locale)
}

function readQueryLocale() {
  const value = new URLSearchParams(window.location.search).get('lang')
  if (value && isSupportedLocale(value)) return value
  return null
}

function readStoredLocale() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value && isSupportedLocale(value)) return value
  } catch {
    /* ignore */
  }
  return null
}

export function getInitialLocale() {
  return readQueryLocale() ?? readStoredLocale() ?? DEFAULT_LOCALE
}

export function getLocale() {
  return currentLocale
}

/** @param {string} path @param {string} [locale] */
export function translate(path, locale = getLocale()) {
  const parts = path.split('.')
  let node = getMessageTree(locale)
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** @param {string} locale */
export function applyLocale(locale) {
  if (!isSupportedLocale(locale)) locale = DEFAULT_LOCALE
  currentLocale = locale

  document.documentElement.lang = locale === 'ja' ? 'ja' : 'en'

  const title = translate('meta.title', locale)
  const description = translate('meta.description', locale)
  if (title) document.title = title
  const metaDesc = document.querySelector('meta[name="description"]')
  if (metaDesc && description) metaDesc.setAttribute('content', description)

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n')
    if (!key) continue
    const value = translate(key, locale)
    if (value != null) el.textContent = value
  }

  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const key = el.getAttribute('data-i18n-html')
    if (!key) continue
    const value = translate(key, locale)
    if (value != null) el.innerHTML = sanitizeI18nHtml(value)
  }

  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    const spec = el.getAttribute('data-i18n-attr')
    if (!spec) continue
    const [attr, key] = spec.split(':')
    if (!attr || !key || !I18N_ATTR_ALLOWLIST.has(attr)) continue
    const value = translate(key, locale)
    if (value != null) el.setAttribute(attr, value)
  }

  for (const btn of document.querySelectorAll('[data-locale]')) {
    const active = btn.getAttribute('data-locale') === locale
    btn.setAttribute('aria-pressed', String(active))
    btn.classList.toggle('is-active', active)
  }

  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }

  document.dispatchEvent(new CustomEvent('planetz-locale-change', { detail: { locale } }))
}

/** @param {string} locale */
export function setLocale(locale) {
  applyLocale(locale)
}

export function initI18n() {
  const locale = getInitialLocale()
  applyLocale(locale)

  for (const btn of document.querySelectorAll('[data-locale]')) {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-locale')
      if (next && isSupportedLocale(next)) setLocale(next)
    })
  }
}
