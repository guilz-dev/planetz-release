#!/usr/bin/env bash
# Source from other bash scripts to activate Node 24 (.nvmrc) before pnpm/node tools run.
# Usage: source "$(dirname "$0")/ensure-node24.sh"   # defines ensure_node24; does not run it.

ensure_node24() {
  local root="${PLANETZ_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

  node24_ok() {
    node "$root/scripts/verify-node.mjs" >/dev/null 2>&1
  }

  if node24_ok; then
    return 0
  fi

  local nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ ! -s "$nvm_sh" ]; then
    echo "[ensure-node24] Node 24 is required (.nvmrc). Install nvm, then: nvm install && nvm use" >&2
    node "$root/scripts/verify-node.mjs" || true
    return 1
  fi

  # shellcheck source=/dev/null
  . "$nvm_sh"
  if [ -f "$root/.nvmrc" ]; then
    nvm use >/dev/null 2>&1 || nvm use "$(tr -d ' \n\r' < "$root/.nvmrc")" >/dev/null 2>&1
  else
    nvm use 24 >/dev/null 2>&1
  fi

  if command -v hash >/dev/null 2>&1; then
    hash -r
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi

  if ! node24_ok; then
    echo "[ensure-node24] Node 24 is required (.nvmrc). Install nvm, then: nvm install && nvm use" >&2
    node "$root/scripts/verify-node.mjs" || true
    return 1
  fi
}
