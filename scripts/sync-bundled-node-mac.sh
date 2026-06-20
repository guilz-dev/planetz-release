#!/usr/bin/env bash
# Copy the active Node 24 binary into apps/desktop/resources/node for macOS packaging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[sync-bundled-node-mac] skip: macOS only"
  exit 0
fi

# shellcheck source=scripts/ensure-node24.sh
source "$ROOT/scripts/ensure-node24.sh"
ensure_node24

NODE_SRC="$(node -p "process.execPath")"
DEST_DIR="$ROOT/apps/desktop/resources/node/bin"
DEST_BIN="$DEST_DIR/node"
VERSION_FILE="$ROOT/apps/desktop/resources/node/VERSION"

mkdir -p "$DEST_DIR"
cp "$NODE_SRC" "$DEST_BIN"
chmod +x "$DEST_BIN"
node -v >"$VERSION_FILE"

echo "[sync-bundled-node-mac] wrote $DEST_BIN ($(cat "$VERSION_FILE"))"
