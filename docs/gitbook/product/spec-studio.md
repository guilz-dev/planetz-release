# Spec Studio & Intent

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

Spec Studio is where your **intent** lives — where you decide what you want, lock it in, and later check whether the implementation actually matched. It's the human-facing front end of the [Intent Ledger](../concepts/intent-ledger.md).

---

## A three-phase flow

Spec Studio walks a spec thread through three phases:

1. **Pin down intent** — capture the **Decided intent**: *what it satisfies*, *why* (background and aim), and what's **out of scope**. You can write it directly, or **auto-generate it from a conversation**.
2. **Lock in the spec** — turn the intent into a spec with requirements and decisions (an ADR-style record). This is what later work is held accountable to.
3. **Check implementation drift** — once tasks run against the spec, the **Trace** view shows which decisions each run referenced and where the implementation **drifted** from what you decided.

## Decided intent, in plain language

Note the phrasing the product uses — *what it satisfies*, *why*, *out of scope*. You're not writing a formal specification language; you're stating, in human terms, what you want and what you don't. That's the **recognition-first** approach: intent is something you can express and confirm without being a senior engineer.

## Decisions and trace

Each decision in a spec records whether it **satisfies** or **deviates** from your intent, and its provenance (Required / Designed / Assumed / Observed). When you review them you can say **It's correct**, **Reverse it**, **Adopt** an observation into a requirement, or **Create fix task**. Validation surfaces gaps like *requirements without an intent link* or *decided intents with no linked requirement*.

> This is the truth-source inversion in practice: the spec and its decisions are the anchor, and each run is checked against them — not the other way around.

## Next

- [Decisions](decisions.md) — the focused queue for adjudicating what agents decided.
- [The Intent Ledger](../concepts/intent-ledger.md) — the concept and mechanism behind this screen.
