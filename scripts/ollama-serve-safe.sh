#!/usr/bin/env bash
# Start `ollama serve` with conservative memory defaults to reduce OOM / system freeze
# when a large local model is loaded. Overrides are loaded from:
#   PLANETZ_OLLAMA_SERVE_ENV, or scripts/ollama-serve-safe.env, or the environment.
#
# Usage (repo root):
#   bash scripts/ollama-serve-safe.sh
#   make ollama-serve-safe
#
# For the macOS menu-bar app instead, use scripts/open-ollama-safe.sh (launchctl env + open).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PLANETZ_OLLAMA_SERVE_ENV:-$ROOT/scripts/ollama-serve-safe.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-30s}"
export OLLAMA_CONTEXT_LENGTH="${OLLAMA_CONTEXT_LENGTH:-8192}"
export LLAMA_ARG_FIT="${LLAMA_ARG_FIT:-on}"
export LLAMA_ARG_FIT_TARGET="${LLAMA_ARG_FIT_TARGET:-6144}"

OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
OLLAMA_SCHEME_HOST="${OLLAMA_HOST#*://}"
OLLAMA_HTTP_HOST="${OLLAMA_SCHEME_HOST%%/*}"
if [[ "$OLLAMA_HTTP_HOST" != *:* ]]; then
  OLLAMA_HTTP_HOST="${OLLAMA_HTTP_HOST}:11434"
fi
OLLAMA_HEALTH_URL="http://${OLLAMA_HTTP_HOST}/api/version"

if command -v curl >/dev/null 2>&1 && curl -fsS -m 2 "$OLLAMA_HEALTH_URL" >/dev/null 2>&1; then
  echo "ollama-serve-safe: already listening at $OLLAMA_HEALTH_URL (quit Ollama first)" >&2
  exit 1
fi

if [[ -n "${PLANETZ_OLLAMA_ULIMIT_VIRT_GB:-}" ]]; then
  # macOS/bash: ulimit -v is KiB. Best-effort; may be ignored on some shells.
  ulimit_kib=$((PLANETZ_OLLAMA_ULIMIT_VIRT_GB * 1024 * 1024))
  if ! ulimit -v "$ulimit_kib" 2>/dev/null; then
    echo "ollama-serve-safe: warning: could not set ulimit -v to ${PLANETZ_OLLAMA_ULIMIT_VIRT_GB} GiB" >&2
  else
    echo "ollama-serve-safe: ulimit -v ${PLANETZ_OLLAMA_ULIMIT_VIRT_GB} GiB (virtual memory cap)" >&2
  fi
fi

echo "ollama-serve-safe: starting with:" >&2
echo "  OLLAMA_MAX_LOADED_MODELS=$OLLAMA_MAX_LOADED_MODELS" >&2
echo "  OLLAMA_NUM_PARALLEL=$OLLAMA_NUM_PARALLEL" >&2
echo "  OLLAMA_KEEP_ALIVE=$OLLAMA_KEEP_ALIVE" >&2
echo "  OLLAMA_CONTEXT_LENGTH=$OLLAMA_CONTEXT_LENGTH" >&2
echo "  LLAMA_ARG_FIT=$LLAMA_ARG_FIT LLAMA_ARG_FIT_TARGET=${LLAMA_ARG_FIT_TARGET} (MiB margin)" >&2
echo "  config file: ${ENV_FILE} ($([[ -f $ENV_FILE ]] && echo present || echo missing — using defaults))" >&2

exec ollama serve
