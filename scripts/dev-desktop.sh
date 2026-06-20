#!/usr/bin/env bash
# Cursor (and some CI) set ELECTRON_RUN_AS_NODE=1 globally. That makes Electron
# behave like plain Node: preload never exposes window.orbit and main APIs break.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PLANETZ_ROOT="$ROOT"

# shellcheck source=scripts/ensure-node24.sh
source "$ROOT/scripts/ensure-node24.sh"
ensure_node24

if [ -z "${PLANETZ_NODE_BINARY:-}" ]; then
  NODE_BIN="$(command -v node)"
  export PLANETZ_NODE_BINARY="$NODE_BIN"
fi

# Must match renderer.server.port in apps/desktop/electron.vite.config.ts (strictPort).
readonly DEV_RENDERER_PORT=5174

# Rebuild orbit dist when the submodule revision or src/ changed (avoids stale Composer stream code).
# shellcheck source=scripts/ensure-bundled-orbit.sh
source "$ROOT/scripts/ensure-bundled-orbit.sh"
ensure_bundled_orbit

DESKTOP_PRELOAD_OUT="$ROOT/apps/desktop/out/preload/index.js"
DESKTOP_PRELOAD_SRC="$ROOT/apps/desktop/src/preload/index.ts"
if [ ! -f "$DESKTOP_PRELOAD_OUT" ] || [ "$DESKTOP_PRELOAD_SRC" -nt "$DESKTOP_PRELOAD_OUT" ]; then
  echo "[dev-desktop] Preload out/ is missing or older than src; building desktop bundle..." >&2
  "$ROOT/scripts/with-node24.sh" pnpm --filter @planetz/desktop exec electron-vite build >&2
fi
if ! rg -q 'onComposerSessionStream' "$DESKTOP_PRELOAD_OUT" 2>/dev/null; then
  echo "[dev-desktop] Preload bundle still lacks onComposerSessionStream; rebuilding..." >&2
  "$ROOT/scripts/with-node24.sh" pnpm --filter @planetz/desktop exec electron-vite build >&2
fi

DESKTOP_MAIN_OUT="$ROOT/apps/desktop/out/main/index.js"
DESKTOP_MAIN_SRC="$ROOT/apps/desktop/src/main/app-session.ts"
if [ ! -f "$DESKTOP_MAIN_OUT" ] || [ "$DESKTOP_MAIN_SRC" -nt "$DESKTOP_MAIN_OUT" ]; then
  echo "[dev-desktop] Main out/ is missing or older than src; building desktop bundle..." >&2
  "$ROOT/scripts/with-node24.sh" pnpm --filter @planetz/desktop exec electron-vite build >&2
fi
if ! rg -q 'emitComposerStream' "$DESKTOP_MAIN_OUT" 2>/dev/null; then
  echo "[dev-desktop] Main bundle still lacks emitComposerStream; rebuilding..." >&2
  "$ROOT/scripts/with-node24.sh" pnpm --filter @planetz/desktop exec electron-vite build >&2
fi

if command -v lsof >/dev/null 2>&1; then
  occupied_pids="$(lsof -ti "tcp:${DEV_RENDERER_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$occupied_pids" ]; then
    echo "[dev-desktop] Port ${DEV_RENDERER_PORT} is already in use (PID: ${occupied_pids})." >&2
    echo "[dev-desktop] Quit the other Planetz dev / Vite session, then retry (make dev or pnpm dev)." >&2
    exit 1
  fi
fi

unset ELECTRON_RUN_AS_NODE
export NODE_ENV_ELECTRON_VITE=development
# env -u: Cursor often exports ELECTRON_RUN_AS_NODE=1; Electron must not inherit it.
exec env -u ELECTRON_RUN_AS_NODE pnpm --filter @planetz/desktop exec electron-vite dev
