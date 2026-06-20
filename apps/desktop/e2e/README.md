# Desktop Electron E2E (smoke)

Playwright `_electron.launch` smoke for `contextIsolation` + `window.orbit` + IPC.

## Prerequisites

- Node **24.x** (`nvm use`)
- `pnpm prepare:bundled-orbit` (bundled takt CLI under `third_party/orbit/`)

## Run

From repository root:

```bash
pnpm --filter @planetz/desktop test:e2e
```

Builds production desktop (`electron-vite build`), then runs `e2e/run-smoke.mjs`.

**CI:** GitHub Actions には載せない（現時点はローカル運用で十分）。PR 回帰の自動化が必要になったら [`docs/issues/planetz-electron-e2e-introduction-plan-2026-05-29.md`](../../../docs/issues/planetz-electron-e2e-introduction-plan-2026-05-29.md) の Phase 2 を参照。

## Environment (set by helpers)

| Variable | Purpose |
|----------|---------|
| `PLANETZ_WORKSPACE` | Temp copy of `e2e/fixtures/workspaces/smoke` |
| `PLANETZ_MOCK=1` | Mock task queue (no live LLM) |
| `PLANETZ_E2E_USER_DATA` | Isolated Electron profile (read in main via `apply-e2e-runtime-env.ts`) |

## Optional flags

| Flag | Effect |
|------|--------|
| `PLANETZ_E2E_SKIP_INSTALL=1` | Skip `pnpm install` in the script |
| `PLANETZ_E2E_PLAYWRIGHT_TEST=1` | Use `playwright test -c e2e/playwright.config.mjs` instead of `run-smoke.mjs` |

## Failure artifacts

Under `e2e/test-results/` (gitignored):

- `smoke-failure.png`
- `smoke-trace.zip` (Playwright trace; open with `pnpm exec playwright show-trace`)

## Fixture layout

`fixtures/workspaces/smoke/.planetz/orbit/engine-config.yaml` — minimal sidecar for `takt_ready` bootstrap. Each run copies the fixture to a temp directory.
