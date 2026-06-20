#!/usr/bin/env bash
# Build macOS icon.icns from apps/desktop/resources/icon.png (requires macOS sips + iconutil).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/desktop/resources/icon.png"
OUT="$ROOT/apps/desktop/resources/icon.icns"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/planetz-icon-XXXXXX")"
ICONSET="$WORKDIR/icon.iconset"
mkdir -p "$ICONSET"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[build-desktop-icon-icns] macOS only (sips/iconutil); skip on this host" >&2
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "[build-desktop-icon-icns] missing source: $SRC" >&2
  exit 1
fi

sips -z 16 16 "$SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
cp "$SRC" "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET" -o "$OUT"
echo "[build-desktop-icon-icns] wrote $OUT"
