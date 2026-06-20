# Conversation

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

How to use Conversation mode to think through and shape work *before* it becomes a task — and how a conversation hands off into the rest of Planetz.

---

## When to use it

Tasks are for execution. **Conversation** is for the step before: exploring a problem, investigating the codebase, or drafting what you actually want. Start typing in the composer (*"Anything you need…"*) to begin a thread.

## Conversation modes

A conversation can run in different modes, which change what the assistant is allowed to do:

- **Investigate** — read-only exploration: the assistant can read code and search, but won't edit files or enqueue work on its own.
- **Agent** — can make and verify changes inside the isolated workspace (not your real working tree).
- **Spec** — focuses on drafting a finalize-ready task instruction.

Switching mode starts a new session on the same thread; earlier turns stay in history.

## Hand off to the rest of Planetz

A conversation isn't a dead end — it feeds the loop:

- **Run now** / finalize the discussion into a task.
- **Add to task** — send the latest reply into a new task instruction.
- **Continue conversation** from an issue or task to keep context.
- In Spec mode, the discussion can **auto-generate a decided intent** in [Spec Studio](spec-studio.md).

## Why this matters

Conversation is where **recognition** starts: you talk through what you want in plain language, and Planetz turns it into intent and tasks — instead of forcing you to write a complete spec up front. See [The Intent Ledger](../concepts/intent-ledger.md).

## Next

- [Spec Studio & Intent](spec-studio.md) — turn the conversation into decided, traceable intent.
- [Task deck](task-deck.md) — run the work.
