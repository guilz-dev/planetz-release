#!/usr/bin/env bash
# Electron E2E: build desktop, then run smoke via Playwright _electron.launch.
# Default runner: `node e2e/run-smoke.mjs` (stable in CI-like sandboxes).
# Optional: PLANETZ_E2E_PLAYWRIGHT_TEST=1 to use `playwright test` instead.
# Optional: PLANETZ_E2E_SKIP_INSTALL=1 to skip `pnpm install`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || nvm use >/dev/null 2>&1 || true
fi

if [ ! -f "$ROOT/third_party/orbit/dist/app/cli/index.js" ]; then
  echo "[desktop-e2e] missing third_party/orbit/dist/app/cli/index.js" >&2
  echo "[desktop-e2e] run: pnpm prepare:bundled-orbit" >&2
  exit 1
fi

unset ELECTRON_RUN_AS_NODE
if [ "${PLANETZ_E2E_SKIP_INSTALL:-0}" != '1' ]; then
  pnpm install --filter @planetz/desktop
fi
pnpm --filter @planetz/desktop run build
if [ "${PLANETZ_E2E_PLAYWRIGHT_TEST:-0}" = '1' ]; then
  pnpm --filter @planetz/desktop exec playwright test -c e2e/playwright.config.mjs "$@"
else
  pnpm --filter @planetz/desktop exec node --experimental-strip-types e2e/run-smoke.mjs "$@"
fi
