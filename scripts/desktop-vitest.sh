#!/usr/bin/env bash
# Run Vitest for @planetz/desktop with Node from repo .nvmrc (no pnpm wrapper).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
  cd "${ROOT}"
  nvm use >/dev/null
fi

cd "${ROOT}/apps/desktop"
exec ./node_modules/.bin/vitest run "$@"
