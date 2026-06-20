# Git integration & disposable workspaces

> Status: Core ideas · Target version 0.1.x

## What you'll learn

How Planetz uses Git to make agent work **isolated, diffable, and recoverable** — and why treating the workspace as *disposable* is what lets you let agents run freely.

---

## Code is a derivative of intent

The mental shift that makes Planetz safe to run autonomously:

> **Your intent is the asset worth protecting. The code is a regenerable derivative of it.**

If the [Intent Ledger](intent-ledger.md) holds what you decided, then a workspace full of code is something you can afford to throw away and rebuild. That reframes the whole safety story: instead of building walls to *prevent* an agent from making a mess, you make the workspace **cheap to destroy and rebuild**.

## Isolation: each run in its own box

Planetz runs agents inside an **isolated repository**, separate from the folder you opened:

- Agent execution happens in a Planetz-managed clone, **not** directly in your working tree.
- Your own terminal Git setup and global tool data are **not shared** with Planetz's execution — the two never write to the same project tree.
- Each task works in its own lane (branch), so parallel agents don't collide.

The result: an autonomous run can't quietly corrupt the repo you care about, because it isn't operating in it.

## Diffable, recoverable, auditable

Because everything runs on Git, every run is:

- **Diffable** — you can see exactly what changed, line by line.
- **Recoverable** — a bad run is a branch you discard, not a disaster you clean up.
- **Auditable** — the history of what happened is preserved alongside the decisions the run recorded.

## Recovery = restore intent and regenerate

When something goes wrong, recovery in Planetz isn't a fiddly manual undo of individual edits. Because intent is the protected source of truth and the workspace is disposable, the recovery model is:

> **Restore the intent, regenerate the work.**

You don't have to nurse a broken workspace back to health line by line — you reset to a known-good state and let the fleet rebuild from the intent you've locked in.

## Your workspace, under your control

Planetz keeps its own state in a sidecar inside the workspace you open, and treats your existing project data as off-limits at runtime. You stay in control of your repository; Planetz adds a governed execution layer beside it rather than taking it over. (The exact on-disk layout is summarized in the [Glossary](../reference/glossary.md); you don't need to manage paths by hand.)

## Next

- [The harness: govern, don't pre-approve](harness-governance.md) — how runs inside these isolated repos are gated.
- [Edge AI & data sovereignty](edge-ai.md) — keeping the models, too, on your machine.
