# Planetz Agent Deck

Desktop agent operations deck for [takt](https://github.com/nrslib/takt) workspaces (harness shown in-app as **orbit**).

**Planetz Agent Deck** is an independent Planetz project. It is **not** affiliated with, endorsed by, or maintained by the [takt](https://github.com/nrslib/takt) authors or repository.

## Download (macOS)

- Release page: [https://github.com/guilz-dev/planetz-release/releases/latest](https://github.com/guilz-dev/planetz-release/releases/latest)
- Direct DMG: [https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg](https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg)

## User documentation

Product guides live under [`docs/gitbook/`](docs/gitbook/) (English and Japanese).

## Prerequisites

- Node.js 24.x (`nvm use` reads `.nvmrc`)
- pnpm 10.x (`corepack enable`)
- Git with submodule support

## Quick start (from source)

```bash
git clone --recursive https://github.com/guilz-dev/planetz-release.git
cd planetz-release
pnpm install
pnpm prepare:bundled-orbit
pnpm dev
```

Optional: open a workspace without the folder picker:

```bash
PLANETZ_WORKSPACE=/path/to/repo pnpm dev
```

## Build (macOS)

Requires a macOS host for `.dmg` / `.app` packaging.

```bash
pnpm install
git submodule update --init --recursive
pnpm prepare:bundled-orbit
make package-desktop-mac-dir   # unpacked .app
# or
make package-desktop-mac       # .dmg
```

Artifacts: `apps/desktop/release/<version>/`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

See [LICENSE](LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
