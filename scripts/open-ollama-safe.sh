#!/usr/bin/env bash
# Apply the same memory-safe Ollama env vars for the macOS Ollama.app (menu bar), then open it.
# launchctl setenv affects GUI apps started after this script; quit Ollama first if it is running.
#
# Usage:
#   bash scripts/open-ollama-safe.sh
#   make open-ollama-safe
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

for key in \
  OLLAMA_MAX_LOADED_MODELS \
  OLLAMA_NUM_PARALLEL \
  OLLAMA_KEEP_ALIVE \
  OLLAMA_CONTEXT_LENGTH \
  LLAMA_ARG_FIT \
  LLAMA_ARG_FIT_TARGET
do
  launchctl setenv "$key" "${!key}"
done

if [[ -n "${PLANETZ_OLLAMA_ULIMIT_VIRT_GB:-}" ]]; then
  echo "open-ollama-safe: PLANETZ_OLLAMA_ULIMIT_VIRT_GB applies to ollama serve only; use scripts/ollama-serve-safe.sh" >&2
fi

echo "open-ollama-safe: set launchctl env (quit Ollama.app if running, then reopen):" >&2
echo "  OLLAMA_MAX_LOADED_MODELS=$OLLAMA_MAX_LOADED_MODELS OLLAMA_KEEP_ALIVE=$OLLAMA_KEEP_ALIVE" >&2
echo "  LLAMA_ARG_FIT_TARGET=${LLAMA_ARG_FIT_TARGET} MiB" >&2

if ! open -a Ollama 2>/dev/null; then
  echo "open-ollama-safe: Ollama.app not found; use: bash scripts/ollama-serve-safe.sh" >&2
  exit 1
fi
