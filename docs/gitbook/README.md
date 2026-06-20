# Planetz

**Edge AI and a desktop robot, delivering a state-of-the-art development experience — all on your own machine.**

> ⭐ **Open source.** The Planetz desktop app is developed in the open and published on GitHub.

> 🌐 日本語版は [`ja/`](ja/README.md) にあります（English is the primary edition）.

Planetz is a desktop command center for a whole [squad of AI coding agents](concepts/multi-agent.md). You queue real work as **tasks** and direct the fleet from a single [deck](product/task-deck.md) while it runs in parallel — every agent on the same governed loop, on hardware you control.

This page describes Planetz as a finished product. Some of it ships today; some is on the [roadmap](roadmap/whats-next.md). Either way, the shape of the value is the same.

## One harness for every AI

Codex, Claude, Cursor, and local edge models all run under a single development loop — the same process and the same **harness** for every agent. You design the loop once instead of relearning each tool.

- **Ready on day one, yours to shape.** The harness comes set up and works well out of the box, then bends to how your team actually builds.
- **Edge AI without the compromise.** Keeping your source and internal docs off public APIs means running on [edge models](concepts/edge-ai.md) — where the harness and tooling are generally still too thin for a development loop like this. Planetz brings the same SDK, harness, and development loop to edge AI as to the cloud, so going local costs you nothing in capability. Today it's edge-first; over time you'll pick edge or cloud per task, putting a whole range of development styles in one place.

## Drift surfaces before release, not after

The intent you decided — what you want and what's out of scope — is locked as an anchor agents can't rewrite. Every decision a run makes is traced against it, so work that wanders off course shows up on the deck instead of in production. → [Intent Ledger](concepts/intent-ledger.md)

## Govern instead of babysitting

You don't gate every step. Workspaces are disposable and rebuildable, so agents run freely and you react to outcomes in plain human terms — *wrong / undo / good*. Only genuinely irreversible actions (send, deploy, delete) wait for a deliberate go, which keeps mistakes contained, visible, and recoverable. → [The harness](concepts/harness-governance.md)

## Built on Git

Every run is isolated, diffable, and recoverable. Code is treated as a regenerable derivative of intent, so a workspace can blow up and be rebuilt from scratch. → [Git integration](concepts/git-integration.md)

## Who it's for

Teams who want agents to do the work but need the result to stay **maintainable and on-spec** — without requiring every operator to be a senior engineer. The one skill Planetz asks for isn't engineering literacy; it's the human ability to recognize whether an outcome is what you wanted.

## Start here

1. **[Install](getting-started/install.md)** — get it on macOS from the `dmg`.
2. **[Overview & mental model](concepts/overview.md)** — how the pieces fit into one loop.
3. **[The Intent Ledger](concepts/intent-ledger.md)** — the core idea, in depth.
4. **[How Planetz is different](why/how-planetz-is-different.md)** — why this approach, and what it's built on.
5. **[The problem it removes](why/the-problem.md)** — drift and approval fatigue.
6. **[Workspace & UI overview](product/ui-overview.md)** — the product, screen by screen.

Prefer to follow a real run end to end? See **[the standard workflow](workflow/standard-workflow.md)**. New to a term? The **[glossary](reference/glossary.md)** and **[FAQ](reference/faq.md)** have you covered.

> _This documentation is an early complete draft — re-check UI labels against your build._
