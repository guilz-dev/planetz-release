#!/usr/bin/env bash
# Full bundled-orbit refresh (ci + build + resource sync). Prefer ensure-bundled-orbit for dev.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/ensure-bundled-orbit.sh
source "$ROOT/scripts/ensure-bundled-orbit.sh"
ensure_bundled_orbit --full
