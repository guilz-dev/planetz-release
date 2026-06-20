# Contributing to Planetz Agent Deck

Thank you for your interest in contributing.

## Development setup

1. Install Node.js 24.x and pnpm 10.x.
2. Clone with submodules:

   ```bash
   git clone --recursive https://github.com/guilz-dev/planetz-release.git
   cd planetz-release
   ```

3. Install dependencies and prepare bundled orbit:

   ```bash
   pnpm install
   pnpm prepare:bundled-orbit
   ```

4. Run the desktop app:

   ```bash
   pnpm dev
   ```

## Verification

From the repository root:

```bash
pnpm verify:node
pnpm lint
pnpm typecheck
pnpm test
pnpm check:security-dom
pnpm check:skin
```

## Pull requests

- Keep changes focused and explain the user-visible outcome in the PR description.
- Update user-facing docs under `docs/gitbook/` when UI labels or flows change.
- Commit messages and code comments are **English only**.

## Issues

Report bugs and feature requests in this repository's GitHub Issues.
