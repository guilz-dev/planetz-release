# Task deck

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

How to queue real work as tasks and watch the whole fleet run — the day-to-day center of Planetz.

---

## Add a task

Use **Add task** to describe a piece of work. You can:

- **Enqueue** it to run when an agent is free, or **Run now** to start immediately.
- Let the harness pick the process automatically (**Auto** workflow), or choose one yourself. See [Workflows](workflows.md).
- Optionally clarify the task with a short Q&A before finalizing the instruction.

A run started in the background reports progress in the **Tasks** panel — you don't sit and watch a single chat; you queue work and move on.

## Watch the fleet

The **Tasks** and **Agents** panels show everything in flight at once. Each task and agent carries a live status:

| Status | Meaning |
|---|---|
| **idle** | Agent available, nothing running |
| **working** | Actively running |
| **reviewing** | Checking work (maker–checker) |
| **waiting** | Blocked — often a human approval gate |
| **error / failed** | Needs your attention |

This is the shift the product is built around: from typing every instruction to **directing a squad** running in parallel. See [Multi-agent fleet](../concepts/multi-agent.md).

## From an idea, an issue, or a chat

A task doesn't have to start from scratch:

- **Conversation** → shape the work first, then hand the result to a task. See [Conversation](conversation.md).
- **Issue view** → pull a GitHub issue from the origin repo and **Add to queue** (optionally with Auto workflow).

## Recover from failure

A failed task is recoverable, not a dead end — retry it, or correct it. Because every run is isolated in Git, a bad run is a branch you discard rather than a mess to clean up (see [Git integration](../concepts/git-integration.md)).

## Next

- [Execution logs & summary](logs-and-summary.md) — follow a single run in detail.
- [Decisions](decisions.md) — review the calls agents made along the way.
