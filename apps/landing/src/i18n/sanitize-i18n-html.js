import DOMPurify from 'dompurify'

/** Tags used in static landing i18n HTML strings only. */
const I18N_HTML_ALLOWED_TAGS = ['br', 'span', 'strong', 's', 'code']

/** Attributes allowed on sanitized i18n HTML (e.g. span.gradient-text). */
const I18N_HTML_ALLOWED_ATTR = ['class']

/**
 * Sanitize translated HTML before assigning to data-i18n-html targets.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeI18nHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: I18N_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: I18N_HTML_ALLOWED_ATTR,
  })
}
