# Planetz Agent Deck — Landing Page

Product landing page (static site).

| 製品 | 位置づけ |
|------|----------|
| **Planetz Agent Deck** | OSS デスクトップ — ローカル workspace の監視・操作 |
| **Planetz Cloud** | 有料サブスク — クラウド VM 上の workspace をブラウザからコントロール |

## Commands

From repository root:

```bash
pnpm install
pnpm --filter @planetz/landing dev
```

Open http://localhost:5175 (`apps/desktop` renderer dev uses 5174).

```bash
pnpm --filter @planetz/landing build
pnpm --filter @planetz/landing preview
```

Build output: `apps/landing/dist/` — deploy to GitHub Pages, Cloudflare Pages, or any static host.

## Cloud waitlist (FreeWaitlists)

先行登録は [FreeWaitlists](https://freewaitlists.com/) API に POST します（`localStorage` は使いません）。

1. Copy `apps/landing/.env.example` → `apps/landing/.env`（または Cloudflare Pages の **Build environment variables** に設定）
2. Set `VITE_FREEWAITLISTS_WAITLIST_ID` to your waitlist id from the FreeWaitlists dashboard
3. Build / deploy — the id is embedded in the client bundle (same as a public form endpoint)

```bash
pnpm --filter @planetz/landing build
```

## Teaser video + desktop download

The landing page can embed a YouTube teaser and pair it with a macOS download CTA.

1. Set `VITE_YOUTUBE_TEASER_ID` to the uploaded YouTube video id if you want to override the default teaser
2. Optionally set `VITE_DESKTOP_DOWNLOAD_URL` if you want a non-default download target
3. Build / deploy

Current default teaser:

- `https://youtu.be/8j3AIhbUAPY`
- embed URL used by the page: `https://www.youtube.com/embed/8j3AIhbUAPY`

Default desktop download URL:

- `https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg`

If `VITE_YOUTUBE_TEASER_ID` is unset, the page falls back to the current default teaser.

## Assets

- Favicon: `public/favicon.svg` (dark motif, default); `public/favicon-light.svg` for `prefers-color-scheme: light`.
