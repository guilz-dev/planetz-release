# Decisions

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

The **Decision queue** — one focused place to review the calls agents made on their own, and to lock the ones you agree with. This is where governing by *recognition* actually happens.

---

## The decision queue

The Decisions view collects assumptions and choices agents made **without asking you first** — *"Review assumptions the agent made without explicit confirmation."* Instead of reading every diff, you review a short list of the decisions that actually matter.

Each card carries context so you can judge it quickly: the **task** and **run** it came from, its **scope**, how reversible it is, and what it **satisfies** or **deviates** from in your intent. Two badges flag the riskiest ones:

- **Unanchored** — the decision links to nothing in your requirements or design. This is the signature of drift.
- **Observed** — noticed after the fact rather than explicitly decided.

You can also filter to **expensive** (hard-to-undo) decisions only, to triage the ones that matter most.

## Your verdict — and the lock

For each decision you give a verdict in human terms:

| Action | What it does |
|---|---|
| **Approve** | Confirm the decision is what you wanted — it's locked in |
| **Reject** | Reverse a decision you don't want |
| **Adopt** | Promote an observation into a formal requirement |
| **Fix** | Record the decision for correction / enqueue a fix task |

The important part: once you **Approve** or **Reject**, that verdict is **locked** — a later run can't silently overwrite a question you've already settled. That accumulation of locked verdicts is the durable asset described in [The Intent Ledger](../concepts/intent-ledger.md).

## Why review here instead of in code

You're judging *decisions*, not lines. You don't need to be the person who could have written the code — you need to recognize whether the outcome is what you asked for. That's what keeps an AI-built system on-spec without every operator being a senior engineer.

## Next

- [Spec Studio & Intent](spec-studio.md) — where these decisions trace back to your intent.
- [The harness: govern, don't pre-approve](../concepts/harness-governance.md) — why review happens after the fact, not before each step.
