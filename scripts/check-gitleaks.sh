#!/usr/bin/env bash
# Scan the repository for hardcoded secrets via gitleaks (git history + working tree).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS_VERSION="${GITLEAKS_VERSION:-8.30.1}"
CACHE_DIR="$ROOT/.tmp/gitleaks/${GITLEAKS_VERSION}"
CONFIG="$ROOT/.gitleaks.toml"

resolve_os() {
  case "$(uname -s)" in
    Darwin) echo darwin ;;
    Linux) echo linux ;;
    *)
      echo "check:gitleaks: unsupported OS: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

resolve_arch() {
  case "$(uname -m)" in
    arm64 | aarch64) echo arm64 ;;
    x86_64 | amd64) echo x64 ;;
    *)
      echo "check:gitleaks: unsupported arch: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

resolve_gitleaks_bin() {
  if [[ -n "${GITLEAKS_BIN:-}" ]]; then
    echo "$GITLEAKS_BIN"
    return
  fi
  if command -v gitleaks >/dev/null 2>&1; then
    command -v gitleaks
    return
  fi

  local os arch bin url
  os="$(resolve_os)"
  arch="$(resolve_arch)"
  bin="$CACHE_DIR/gitleaks"
  if [[ ! -x "$bin" ]]; then
    mkdir -p "$CACHE_DIR"
    url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz"
    echo "check:gitleaks: downloading gitleaks v${GITLEAKS_VERSION} (${os}/${arch})..." >&2
    curl -fsSL "$url" | tar -xz -C "$CACHE_DIR" gitleaks
    chmod +x "$bin"
  fi
  echo "$bin"
}

main() {
  local bin
  bin="$(resolve_gitleaks_bin)"
  "$bin" detect \
    --source "$ROOT" \
    --config "$CONFIG" \
    --redact \
    "$@"
  echo "check:gitleaks OK"
}

main "$@"
