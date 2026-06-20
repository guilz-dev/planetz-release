#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))

const SCAN_ROOTS = [join(root, 'apps/landing/src'), join(root, 'apps/desktop/src/renderer')]

const EXTENSIONS = new Set(['.js', '.ts', '.tsx'])

/** Only this file may assign innerHTML, and only via sanitizeI18nHtml. */
const INNER_HTML_ALLOWLIST = new Set(['apps/landing/src/i18n/locale.js'])

const INNER_HTML_PATTERN = /\.innerHTML\s*=/
const DANGEROUS_REACT_PATTERN = /dangerouslySetInnerHTML/

function collectFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      collectFiles(path, out)
      continue
    }
    const ext = name.slice(name.lastIndexOf('.'))
    if (EXTENSIONS.has(ext)) {
      out.push(path)
    }
  }
  return out
}

function isAllowedInnerHtmlAssignment(relPath, line) {
  if (!INNER_HTML_ALLOWLIST.has(relPath)) {
    return false
  }
  return line.includes('sanitizeI18nHtml(')
}

const violations = []

for (const scanRoot of SCAN_ROOTS) {
  let files = []
  try {
    files = collectFiles(scanRoot)
  } catch {
    continue
  }
  for (const file of files) {
    const rel = relative(root, file)
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNo = i + 1
      if (INNER_HTML_PATTERN.test(line)) {
        if (!isAllowedInnerHtmlAssignment(rel, line)) {
          violations.push({
            file: rel,
            line: lineNo,
            rule: 'innerHTML',
            detail: 'use sanitizeI18nHtml in locale.js only',
          })
        }
      }
      if (DANGEROUS_REACT_PATTERN.test(line)) {
        violations.push({
          file: rel,
          line: lineNo,
          rule: 'dangerouslySetInnerHTML',
          detail: 'not allowed in renderer',
        })
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Dangerous DOM API usage detected:')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.detail}`)
  }
  process.exit(1)
}

console.log('check:security-dom OK')
