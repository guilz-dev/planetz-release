#!/usr/bin/env bash
# Build Planetz Agent Deck for macOS (.dmg or unpacked .app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DIR_ONLY=false
if [[ "${1:-}" == "--dir" ]]; then
  DIR_ONLY=true
elif [[ -n "${1:-}" ]]; then
  echo "usage: $(basename "$0") [--dir]" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[package-desktop-mac] macOS is required to build a macOS installer (.dmg / .app)." >&2
  exit 1
fi

WITH_NODE=(bash "$ROOT/scripts/with-node24.sh")

echo "[package-desktop-mac] initializing git submodules..."
git submodule update --init --recursive

echo "[package-desktop-mac] preparing bundled orbit..."
"${WITH_NODE[@]}" pnpm prepare:bundled-orbit

echo "[package-desktop-mac] syncing bundled Node for macOS..."
bash "$ROOT/scripts/sync-bundled-node-mac.sh"

echo "[package-desktop-mac] verifying bundled assets..."
"${WITH_NODE[@]}" node scripts/verify-bundled-assets.mjs --desktop-package

echo "[package-desktop-mac] building icon.icns..."
"${WITH_NODE[@]}" pnpm --filter @planetz/desktop run build:icon-icns

if [[ "$DIR_ONLY" == true ]]; then
  echo "[package-desktop-mac] building unpacked .app..."
  "${WITH_NODE[@]}" pnpm --filter @planetz/desktop run build
  "${WITH_NODE[@]}" pnpm --filter @planetz/desktop run dist:mac:dir
else
  echo "[package-desktop-mac] building DMG..."
  "${WITH_NODE[@]}" pnpm --filter @planetz/desktop run package:mac
fi

echo "[package-desktop-mac] done"
