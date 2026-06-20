#!/usr/bin/env bash
# Start apps/landing Vite dev server (port 5175). Requires Node 24.x for pnpm.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec pnpm dev:landing
