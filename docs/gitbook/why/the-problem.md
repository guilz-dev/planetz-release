# The problem: drift & approval fatigue

> Status: Why Planetz · Target version 0.1.x

## What you'll learn

Autonomous coding agents are good enough to do real work. So why does handing work to them still feel risky? Two failure modes — **drift** and **approval fatigue** — and why faster, smarter models make them *worse*, not better.

---

## Agents can do the work. Keeping them honest is the hard part.

A modern coding agent can read a repository, make a plan, change many files, run the tests, and open a pull request — on its own. The capability is real. The problem is no longer "can the agent write the code." It is:

> **How do you keep a growing, AI-built system aligned with everything you've already decided — without reading every line yourself?**

When you let agents run, two things break.

## Failure mode 1 — Drift

**Drift is when the agent quietly moves away from what you actually asked for, and nobody notices until it ships.**

It happens for a structural reason, not because the model is "dumb":

- **Provenance is lost.** Once an agent is involved, the line between *what you decided* and *what the AI chose on its own* evaporates. Months later, nobody can say which behaviors were intended and which were a model's silent guess.
- **Nobody reconciles.** Each run solves its own little problem in isolation. An agent is a brilliant but **stateless contractor**: it has no memory of, or stake in, the decisions made three sessions ago, so it patches locally instead of integrating with the whole. Those local patches pile up, and the product slowly diverges from the sum of everything you ever asked for.

This is why mediocre outcomes usually come from **drift, not from a lack of genius** — products rot from a thousand small, unreconciled decisions, not from one bad architectural call.

## Failure mode 2 — Approval fatigue

The obvious defense against drift is to **approve every step**. That fails differently.

- **It turns you into a rubber stamp.** Approve, approve, approve — by the tenth prompt you are clicking "yes" without reading. The gate that was supposed to protect you becomes a reflex.
- **It demands foresight you don't have.** To approve a step *before* it runs, you have to predict what could go wrong. Real systems have too many failure paths to enumerate, so pre-approval is never complete — it just *feels* safe.

So you're stuck between two bad options: let it run and risk drift, or gate everything and become a tired, ineffective approver.

## The honest boundary

Planetz starts from an honest admission: **for effects that truly can't be undone — money moved, an email sent, production deleted — there are only two doors: prevent it (impossible to do perfectly) or approve it. There is no magic third door.**

But here's the key insight: **almost all of an agent's work is not irreversible.** Code in a workspace can be thrown away and regenerated. So the right move is to stop guarding the *reversible* majority with heavy gates, and reserve a calm, deliberate confirmation for the *genuinely irreversible* few. (This is exactly where the optional **Manta** desktop robot comes in — a single physical "go" for the rare action that deserves one. More in [How Planetz is different](how-planetz-is-different.md).)

## Why this gets *worse* as models improve

It's tempting to think "smarter models will fix this." The opposite is true:

> The smarter a model is, the **more it decides silently on your behalf** — so provenance loss accelerates, and the gap between what you meant and what shipped widens.

Better models make the *coding* a commodity. They do **not** give you continuity of intent, a stake in past decisions, or the discipline to reconcile new work with old. Those come from the harness around the agent, not from the model's weights. That is the gap Planetz is built to close.

## What Planetz does about it

- Keep your intent as a durable record agents can't quietly rewrite — so **drift becomes visible**, not discovered after release.
- Let agents **run freely** in a disposable, rebuildable workspace, and let you **react to outcomes** in plain human terms instead of pre-approving every step.
- Stage only the **truly irreversible** actions for a deliberate confirmation.

## Next

- [How Planetz is different](how-planetz-is-different.md) — versus chat assistants and "anyone can build" tools, plus edge AI and the Manta desktop robot.
- [The Intent Ledger](../concepts/intent-ledger.md) — the mechanism that makes drift visible.
