# Multi-agent fleet

> Status: Core ideas · Target version 0.1.x

## What you'll learn

Why Planetz is built around a *squad* of agents instead of one chat thread, and how running work in parallel lanes changes your job from typing to directing.

---

## From one chat window to a deck

A single chat assistant does one thing at a time, in one conversation. Planetz runs a **fleet**: multiple autonomous agents, each working its own task in its own lane, all visible on one deck.

> Your role shifts from *writing every line* to **directing the squad** — reviewing, steering, and approving — while the work happens in parallel.

The deck shows the fleet at a glance: how many agents are active, and what each one is doing right now.

## Agents have roles

Work is divided across specialized roles rather than one generalist doing everything. Typical roles include:

- **Planner** — turns a task into a plan.
- **Coder** — makes the changes (in an isolated lane / branch).
- **Reviewer** — checks the work against intent and quality bars.
- **Tester** — runs and reproduces tests.

This **maker–checker** split is deliberate: the agent that writes the code is not the only agent that judges it. Separation is what keeps an autonomous run honest.

## Lanes and parallelism

Each running task gets its own isolated lane — its own branch and workspace — so agents don't step on each other. You can run many at once and let them progress independently. Each agent reports a live status:

| Status | Meaning |
|---|---|
| **idle** | Available, no active task |
| **working** | Actively running a task |
| **reviewing** | Checking work (maker–checker) |
| **waiting** | Blocked — often waiting on a human gate |
| **error** | Run hit a problem and needs attention |

That single state vocabulary is the same language the optional **Manta** desktop robot speaks, so the fleet's state can be felt at a glance — on screen or on the device. See [Edge AI & data sovereignty](edge-ai.md) and [How Planetz is different](../why/how-planetz-is-different.md).

## Bring your own agents

The fleet isn't limited to Planetz's built-in runtime. External agents — for example **Cursor** — can join the deck and push their status in, so a mixed squad of built-in and external agents is visible and governed from the same place.

## Why a fleet needs the ledger

Parallelism multiplies a danger: several agents, in several lanes, each quietly making decisions. Without a shared record, those decisions never get reconciled and the product drifts. That's why the fleet only delivers its promise when it's paired with the [Intent Ledger](intent-ledger.md) — every agent's decisions land in one place, traced against one intent, where you can see conflicts and lock the calls you agree with.

## Where you see it in the product

- **[Task deck](../product/task-deck.md)** — queue work and watch the fleet.
- **[Execution logs & summary](../product/logs-and-summary.md)** — follow any single agent's run in detail.

## Next

- [The harness: govern, don't pre-approve](harness-governance.md) — the workflows the fleet runs inside.
- [Git integration & disposable workspaces](git-integration.md) — how lanes stay isolated and recoverable.
