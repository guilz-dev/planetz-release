# The Intent Ledger

> Status: Core ideas · Target version 0.1.x

## What you'll learn

The single idea that makes Planetz more than a nicer agent runner: a durable record of **what was decided, by whom, and whether it still matches what you wanted.** This is the mechanism that turns invisible drift into something you can see and lock down.

---

## The inversion: intent becomes the source of truth

In a normal codebase, the **code is the truth** — it's the only place that records what the system actually does, and intent lives in scattered tickets, chat logs, and people's heads. When agents start writing most of the code, that's fatal: nobody can say which behaviors were *decided* and which the AI just *guessed*.

Planetz inverts it:

> **The Intent Ledger is the source of truth. Code and tests answer to it.**

The ledger is kept as a durable record, outside the disposable workspace. The code can be thrown away and regenerated; the record of what you decided is the asset that survives.

## What a decision captures

As agents work, every meaningful decision they make is recorded — not as a bare line of code, but as an entry that captures the things people normally lose track of:

| Each decision records… | In plain terms | Why it matters |
|---|---|---|
| **What was decided** | The decision, in a sentence | A human-readable record, not a diff |
| **Where it came from** | Your explicit requirement, a design choice, the agent's own assumption, or something only noticed after the fact | **Provenance** — the line between *what you decided* and *what the AI chose* that normally evaporates |
| **How it relates to your intent** | Whether it supports something you asked for — or moves away from it | **Traceability** — this is what lets drift be detected automatically |
| **How hard it is to undo** | Cheap to reverse, or costly | Decides where a deliberate confirmation is actually worth it |

The *"where it came from"* axis is the heart of it. The difference between *"you required this"* and *"an agent assumed this"* is exactly the provenance that normally disappears the moment an agent is involved — and Planetz keeps it.

## How drift becomes visible

A decision is **anchored** when it traces to something you actually decided (a requirement, a design item, a task). A decision that traces to *nothing* is **unanchored** — an agent changed behavior without any link to your intent.

> **Unanchored decisions are the signature of drift.** Instead of discovering them after release, you see them on the deck as they happen.

This powers a simple, strict rule the harness can enforce: a material behavior change must either trace to your intent **or** be explicitly recorded as an assumption. Silent, unrecorded changes are rejected; honestly-recorded assumptions are allowed through. The goal isn't to forbid the agent from making calls — it's to forbid it from making them *silently*.

## Recognition, not specification

You are **not** asked to write a perfect spec up front. That's the expert skill that doesn't transfer, and even experts can't do it — specs are discovered as you build.

Instead, you govern by **recognition**: you look at a decision the agent surfaced and judge it in human terms. When you agree, you **ratify** it; when you don't, you **reverse** it. This is something almost everyone can do — and it's why an AI-built system can stay on-spec without every operator being a senior engineer.

## Locking decisions: the durable moat

Here's the part competitors can't easily copy. Once you **ratify** or **reverse** a decision, that verdict is **locked** — a later run cannot silently overwrite it. The next agent doesn't get to re-decide a question you already settled.

This matters because of a hard-won finding: a single line of instruction can already make today's models *stop and ask* instead of deciding silently — so "stop and ask" will soon be commodity behavior baked into every model. What *won't* be baked into any model's weights is **your project's accumulated, locked decisions** — the answer to *"what must this new work be consistent with?"* That record is specific to you, and it's where the durable value lives.

> Models will keep getting smarter at *writing* code. They will never carry the continuity of *your* decisions. The Intent Ledger does.

## Where you see it in the product

- **[Spec Studio](../product/spec-studio.md)** — author intent and trace requirements.
- **[Decisions](../product/decisions.md)** — review what agents decided, and ratify or reverse.
- **Task deck** — drift and pending decisions surface on the cards, not after the merge.

## Next

- [The harness: govern, don't pre-approve](harness-governance.md) — how the ledger plugs into safe, gated execution.
- [Multi-agent fleet](multi-agent.md) — the agents whose decisions the ledger records.
