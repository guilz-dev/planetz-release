#!/usr/bin/env bash
# Run a command with Node 24 active (.nvmrc). Used by the repo Makefile.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PLANETZ_ROOT="$ROOT"

# shellcheck source=scripts/ensure-node24.sh
source "$ROOT/scripts/ensure-node24.sh"

usage() {
  echo "usage: $(basename "$0") <command> [args...]" >&2
  exit 1
}

[ $# -ge 1 ] || usage
ensure_node24
exec "$@"
