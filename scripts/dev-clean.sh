#!/usr/bin/env bash
# Stop Planetz desktop dev processes and clear Vite pre-bundles before a clean pnpm dev.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Must match renderer.server.port in apps/desktop/electron.vite.config.ts (strictPort).
readonly DEV_RENDERER_PORT=5174

echo "[dev-clean] Stopping renderer dev port ${DEV_RENDERER_PORT} (if listening)..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti "tcp:${DEV_RENDERER_PORT}" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
fi

echo "[dev-clean] Stopping Planetz electron-vite / Electron in this repo (best effort)..."
pkill -f "${ROOT}/.*electron-vite.*dev" 2>/dev/null || true
pkill -f "${ROOT}/node_modules/.pnpm/electron@" 2>/dev/null || true

echo "[dev-clean] Removing Vite dependency pre-bundle cache..."
rm -rf "$ROOT/apps/desktop/node_modules/.vite"

echo "[dev-clean] Done. Start a single session: pnpm dev (or make dev)"
echo "[dev-clean] Expect in terminal: [planetz] window.orbit available: true"
