# Planetz convenience targets. `make dev` runs scripts/dev-desktop.sh (Node 24,
# port preflight, ELECTRON_RUN_AS_NODE unset). Other recipes use with-node24.sh
# so you do not need `nvm use` first (nvm must be installed).
WITH_NODE := bash scripts/with-node24.sh

.PHONY: help dev install test test-coverage typecheck lint lint-fix build verify-node \
	dev-landing deploy-landing check-skin check-security-dom check-gitleaks prepare-bundled-orbit \
	package-desktop-mac package-desktop-mac-dir ollama-serve-safe open-ollama-safe \
	record-intro-demo record-intro-demo-video build-intro-video intro-video intro-video-motion \
	record-intro-demo-scenario build-intro-scenario intro-video-scenario \
	sync-oss-release verify-oss-release

.DEFAULT_GOAL := help

help:
	@echo "Planetz — Node 24 is selected automatically (see scripts/with-node24.sh)"
	@echo ""
	@echo "  make dev                 pnpm dev (Electron desktop; rebuilds orbit dist when needed)"
	@echo "  make prepare-bundled-orbit  pnpm prepare:bundled-orbit (full orbit ci+build+sync)"
	@echo "  make dev-landing         pnpm dev:landing"
	@echo "  make deploy-landing      build apps/landing and deploy to Cloudflare Pages"
	@echo "  make install             pnpm install"
	@echo "  make test                pnpm test"
	@echo "  make test-coverage       pnpm test:coverage (Vitest v8; HTML under each package coverage/)"
	@echo "  make typecheck           pnpm typecheck"
	@echo "  make lint                pnpm lint"
	@echo "  make lint-fix            pnpm lint:fix"
	@echo "  make build               pnpm build"
	@echo "  make verify-node         pnpm verify:node"
	@echo "  make check-skin          pnpm check:skin"
	@echo "  make check-security-dom  pnpm check:security-dom"
	@echo "  make check-gitleaks      pnpm check:gitleaks (secret scan)"
	@echo "  make package-desktop-mac      macOS DMG (requires macOS; see README)"
	@echo "  make package-desktop-mac-dir  macOS unpacked .app (smoke / local)"
	@echo "  make ollama-serve-safe   Ollama serve with memory-safe defaults (see scripts/ollama-serve-safe.env.example)"
	@echo "  make open-ollama-safe    macOS Ollama.app with same env via launchctl"
	@echo "  make record-intro-demo        Capture intro scene PNGs (default; macOS + display)"
	@echo "  make record-intro-demo-video  Capture UI motion clips (WebM split to scenes/*.mp4)"
	@echo "  make build-intro-video        TTS + ffmpeg mux (MP4 scene clips preferred when present)"
	@echo "  make intro-video              record-intro-demo then build-intro-video"
	@echo "  make intro-video-motion       record-intro-demo-video then build-intro-video"
	@echo "  make record-intro-demo-scenario  Capture scenario-specific still PNGs"
	@echo "  make build-intro-scenario     still PNGs + fixed beat durations -> planetz-intro-senario.mp4"
	@echo "  make intro-video-scenario     record-intro-demo-scenario then build-intro-scenario"
	@echo "  make sync-oss-release TARGET=/path/to/planetz-release [ALLOW_DIRTY_SOURCE=1]  sync OSS tree into target repo"
	@echo "  make verify-oss-release TARGET=/path/to/planetz-release verify OSS target constraints"

dev:
	bash scripts/dev-desktop.sh

prepare-bundled-orbit:
	$(WITH_NODE) pnpm prepare:bundled-orbit

dev-landing:
	$(WITH_NODE) pnpm dev:landing

deploy-landing:
	bash scripts/deploy-landing.sh

install:
	$(WITH_NODE) pnpm install

test:
	$(WITH_NODE) pnpm test

test-coverage:
	$(WITH_NODE) pnpm test:coverage

typecheck:
	$(WITH_NODE) pnpm typecheck

lint:
	$(WITH_NODE) pnpm lint

lint-fix:
	$(WITH_NODE) pnpm lint:fix

build:
	$(WITH_NODE) pnpm build

verify-node:
	$(WITH_NODE) pnpm verify:node

check-skin:
	$(WITH_NODE) pnpm check:skin

check-security-dom:
	$(WITH_NODE) pnpm check:security-dom

check-gitleaks:
	bash scripts/check-gitleaks.sh

package-desktop-mac:
	bash scripts/package-desktop-mac.sh

package-desktop-mac-dir:
	bash scripts/package-desktop-mac.sh --dir

ollama-serve-safe:
	bash scripts/ollama-serve-safe.sh

open-ollama-safe:
	bash scripts/open-ollama-safe.sh

record-intro-demo:
	bash scripts/record-intro-demo.sh

record-intro-demo-video:
	PLANETZ_INTRO_CAPTURE=video PLANETZ_INTRO_VIDEO_ALL=1 bash scripts/record-intro-demo.sh

record-intro-demo-scenario:
	PLANETZ_INTRO_SCRIPT=docs/marketing/planetz-intro-scenario.script.json bash scripts/record-intro-demo.sh

build-intro-video:
	$(WITH_NODE) node scripts/build-intro-video.mjs

intro-video: record-intro-demo build-intro-video

intro-video-motion: record-intro-demo-video build-intro-video

build-intro-scenario:
	PLANETZ_INTRO_SCRIPT=docs/marketing/planetz-intro-scenario.script.json \
	PLANETZ_INTRO_OUTPUT_BASENAME=planetz-intro-senario \
	PLANETZ_INTRO_SEGMENTS_SUBDIR=segments-scenario-fixed \
	PLANETZ_INTRO_BUILD_SOURCE=png \
	$(WITH_NODE) node scripts/build-intro-video.mjs

intro-video-scenario: record-intro-demo-scenario build-intro-scenario

sync-oss-release:
	@[ -n "$(TARGET)" ] || (echo "TARGET is required, e.g. make sync-oss-release TARGET=/path/to/planetz-release" && exit 1)
	$(WITH_NODE) node scripts/sync-oss-release.mjs --target "$(TARGET)" $(if $(filter 1 true yes,$(ALLOW_DIRTY_SOURCE)),--allow-dirty-source,)

verify-oss-release:
	@[ -n "$(TARGET)" ] || (echo "TARGET is required, e.g. make verify-oss-release TARGET=/path/to/planetz-release" && exit 1)
	$(WITH_NODE) node scripts/verify-oss-release.mjs --target "$(TARGET)"
