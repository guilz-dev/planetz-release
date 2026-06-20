#!/usr/bin/env bash
# Ensure third_party/orbit dist matches the checked-out submodule (and local edits).
# Used by dev-desktop.sh so Composer/chat does not run stale orbit JavaScript.
#
# Default: incremental — npm ci only when node_modules is missing or lockfile is newer;
# tsc build when dist is missing, submodule HEAD changed, or src/ is newer than dist.
# --full: same as prepare-bundled-orbit.sh (always ci + build + sync).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORBIT_DIR="$ROOT/third_party/orbit"
ORBIT_CLI="$ORBIT_DIR/dist/app/cli/index.js"
ORBIT_HEADLESS="$ORBIT_DIR/dist/features/interactive/headlessSession.js"
STAMP_FILE="$ROOT/.cursor/local-state/bundled-orbit-rev"
LOCK_FILE="$ORBIT_DIR/package-lock.json"

usage() {
  echo "Usage: bash scripts/ensure-bundled-orbit.sh [--full]" >&2
  echo "  --full  Run npm ci, build, and sync-bundled-assets (like prepare:bundled-orbit)" >&2
}

orbit_submodule_rev() {
  if [ -d "$ORBIT_DIR/.git" ]; then
    git -C "$ORBIT_DIR" rev-parse HEAD
    return 0
  fi
  return 1
}

orbit_src_newer_than_dist() {
  if [ ! -f "$ORBIT_HEADLESS" ]; then
    return 0
  fi
  if find "$ORBIT_DIR/src" -name '*.ts' -newer "$ORBIT_HEADLESS" -print -quit 2>/dev/null | grep -q .; then
    return 0
  fi
  return 1
}

needs_orbit_dependencies() {
  if [ ! -d "$ORBIT_DIR/node_modules" ]; then
    return 0
  fi
  if [ -f "$LOCK_FILE" ] && [ "$LOCK_FILE" -nt "$ORBIT_DIR/node_modules" ]; then
    return 0
  fi
  return 1
}

needs_orbit_build() {
  local full_mode="$1"

  if [ "$full_mode" = true ]; then
    return 0
  fi
  if [ ! -f "$ORBIT_CLI" ] || [ ! -f "$ORBIT_HEADLESS" ]; then
    return 0
  fi
  if orbit_src_newer_than_dist; then
    return 0
  fi
  local rev=""
  if rev="$(orbit_submodule_rev)"; then
    if [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$rev" ]; then
      return 0
    fi
  fi
  return 1
}

install_orbit_dependencies() {
  echo "[bundled-orbit] installing dependencies"
  npm --prefix "$ORBIT_DIR" ci
}

build_orbit_dist() {
  echo "[bundled-orbit] building dist assets"
  npm --prefix "$ORBIT_DIR" run build
  mkdir -p "$(dirname "$STAMP_FILE")"
  if rev="$(orbit_submodule_rev 2>/dev/null)"; then
    printf '%s' "$rev" >"$STAMP_FILE"
  else
    date -u +%Y-%m-%dT%H:%M:%SZ >"$STAMP_FILE"
  fi
}

sync_orbit_resources() {
  echo "[bundled-orbit] syncing assets into resources/"
  node "$ROOT/scripts/sync-bundled-assets.mjs"
}

ensure_bundled_orbit() {
  local full_mode=false
  if [ "${1:-}" = "--full" ]; then
    full_mode=true
  elif [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    return 0
  elif [ -n "${1:-}" ]; then
    echo "[bundled-orbit] unknown argument: $1" >&2
    usage
    return 1
  fi

  if [ ! -d "$ORBIT_DIR" ]; then
    echo "[bundled-orbit] missing submodule directory: $ORBIT_DIR" >&2
    echo "[bundled-orbit] run: git submodule update --init --recursive third_party/orbit" >&2
    return 1
  fi
  if [ ! -f "$ORBIT_DIR/package.json" ]; then
    echo "[bundled-orbit] package.json not found in submodule: $ORBIT_DIR" >&2
    return 1
  fi

  local run_deps=false
  local run_build=false
  local run_sync=false

  if [ "$full_mode" = true ]; then
    run_deps=true
    run_build=true
    run_sync=true
  else
    if needs_orbit_dependencies; then
      run_deps=true
    fi
    if needs_orbit_build false; then
      run_build=true
    fi
    if [ "$run_build" = true ]; then
      run_sync=true
    fi
  fi

  if [ "$run_deps" = false ] && [ "$run_build" = false ] && [ "$run_sync" = false ]; then
    return 0
  fi

  if [ "$run_deps" = true ]; then
    install_orbit_dependencies
  fi
  if [ "$run_build" = true ]; then
    build_orbit_dist
  fi
  if [ "$run_sync" = true ]; then
    sync_orbit_resources
  fi

  echo "[bundled-orbit] ready: $ORBIT_CLI"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ensure_bundled_orbit "$@"
fi
