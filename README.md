# Planetz Agent Deck

Planetz Agent Deck is a desktop app for monitoring and operating AI task workflows in a workspace.

It gives you a single control surface to:

- inspect task state and execution progress
- queue and run work from the desktop UI
- review conversation history, execution logs, and summaries
- manage project-local workflows, facets, and engine settings

Planetz stores product-owned state under **`.planetz/orbit/`** in the workspace you open. The in-app harness is shown as **orbit**.

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

## Relationship to takt

[takt](https://github.com/nrslib/takt) strongly influenced this project and provides the underlying execution engine used by Planetz.

**Planetz Agent Deck** is an independent Planetz project. It is **not** affiliated with, endorsed by, or maintained by the [takt](https://github.com/nrslib/takt) authors or repository. Any issues with this app belong here, not upstream takt.

Planetz adopts takt's core ideas at the center of the product. In the UI, that harness is shown as **orbit**. Bundled takt runs in a separate isolated repo under app user data so your normal `takt` CLI and `~/.takt` on the same folder are not shared with Planetz execution data.
