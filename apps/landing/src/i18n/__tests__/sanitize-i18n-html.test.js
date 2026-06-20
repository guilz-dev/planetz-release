import { describe, expect, it } from 'vitest'
import { sanitizeI18nHtml } from '../sanitize-i18n-html.js'

describe('sanitizeI18nHtml', () => {
  it('keeps tags used in landing i18n messages', () => {
    const input = 'True AI-driven development,<br /><span class="gradient-text">your hands</span>'
    const output = sanitizeI18nHtml(input)
    expect(output).toContain('<br')
    expect(output).toContain('<span class="gradient-text">')
  })

  it('keeps strong strikethrough and code in promo and LCD copy', () => {
    const promo = 'Reserve (<span class="price-promo"><s>$70</s> $35</span>)'
    expect(sanitizeI18nHtml(promo)).toContain('<s>')
    expect(sanitizeI18nHtml('Planetz <strong>solves both</strong>')).toContain('<strong>')
    expect(sanitizeI18nHtml('<code>PROCESSING...</code>')).toContain('<code>')
  })

  it('strips script tags and event handlers', () => {
    const malicious = '<span onclick="alert(1)">x</span><script>alert(1)</script>'
    const output = sanitizeI18nHtml(malicious)
    expect(output).not.toContain('<script')
    expect(output).not.toContain('onclick')
    expect(output).toContain('x')
  })

  it('strips img and javascript URLs', () => {
    const output = sanitizeI18nHtml('<img src=x onerror=alert(1)>')
    expect(output).not.toContain('<img')
    expect(output).not.toContain('onerror')
  })

  it('strips anchor tags and href handlers', () => {
    const output = sanitizeI18nHtml('<a href="javascript:alert(1)">click</a>')
    expect(output).not.toContain('<a')
    expect(output).not.toContain('javascript:')
    expect(output).toContain('click')
  })
})
