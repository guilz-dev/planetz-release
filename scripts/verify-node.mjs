#!/usr/bin/env node
/**
 * Fail fast when the active Node major is not 24 (matches `.nvmrc` and package.json engines).
 */
const major = Number(process.versions.node.split('.')[0])

if (major !== 24) {
  console.error(`[verify-node] expected Node 24.x, got ${process.version}. Run: nvm use`)
  process.exit(1)
}

console.log(`[verify-node] ok (${process.version})`)
