# How Planetz is different

> Status: Why Planetz · Target version 0.1.x

## What you'll learn

Where Planetz sits next to the tools you already know — chat assistants and "anyone can build" app builders — why its real advantage is **governance, not code generation**, and how edge AI and the **Manta** desktop robot fit in.

---

## The market has solved "AI can write code." Nobody has solved "keep it aligned."

Tools like Cursor, v0, Bolt, Lovable, and Replit Agent already prove that AI can build software, and that non-engineers can ship something real. That race is essentially won — and the thing they all do well, *generating code*, is becoming a commodity.

But every one of them hits the same wall at scale: as the system grows, it drifts from what the team actually decided, and no tool keeps it reconciled. **That open ground — keeping a growing, AI-built system aligned with accumulated intent — is where Planetz plays.**

## Versus a chat assistant

A personal AI assistant lives in one chat window and tries to *remember you*. Its "memory" is emergent and private — useful, but impossible to audit, diff, or share with a team.

Planetz is a different shape. Instead of one assistant with a good memory, it runs a **governed process**: a squad of agents following workflows you can inspect, version, and share. The value isn't "an assistant that remembers" — it's **a process you can trust and reproduce**.

| | Chat assistant | Planetz |
|---|---|---|
| Unit of work | One conversation | A fleet of tasks, in parallel |
| "Memory" | Emergent, private | Explicit intent record, auditable |
| Control | Trust the model | Governed workflows + human gates |
| Team fit | Single user | Shared, diffable, reproducible |

## Versus an "anyone can build" tool

Those tools front-load the work: *write a good prompt / spec, and we'll build it.* But writing a complete spec up front is itself the hard, expert skill — so in practice you're back to needing an engineer, and even engineers can't fully specify a system before it exists (specs are *discovered* as you build).

Planetz inverts this. It doesn't ask you to predict the perfect spec. It captures intent **at the moment behavior becomes real** — you look at what the agent did and *recognize* whether it's what you wanted. That skill — recognition — is something almost everyone has, which is the whole point: the result stays maintainable and on-spec **without requiring every operator to be a senior engineer.**

## The real moat: governance, not generation

The deepest finding behind Planetz: when you prompt an agent, the model isn't usually too dumb to notice a conflict — it just **silently decides on its own and patches locally** instead of surfacing the decision to you. A single line of harness instruction flips every model, weak or strong, from "decide silently" to "stop and let the human adjudicate."

So the durable advantage isn't making the AI smarter. It's two things models won't give you for free:

1. **Decision governance** — turn the moments that matter into explicit decision points, instead of silent guesses.
2. **An intent record** — accumulate and lock those decisions so the *next* run doesn't have to rediscover them. This record is specific to your project; it can never be baked into a model's weights, which is why it stays valuable even as models commoditize everything else.

## And it runs the way you want

Three practical differentiators round out the picture:

- **🔌 Edge AI — your code stays yours.** Planetz can run inference on a local model on your own machine (via Ollama), so source code and internal docs never have to leave for a public API — useful for privacy, security, and even working offline. *(Some tool-running workflow steps still use a cloud provider; you choose per workflow.)* When you need more horsepower, **Planetz Cloud** scales up with the same deck and workflows — no relearning.
- **🐠 Manta — the desktop robot (optional).** Manta is a small palm-rest companion device that answers approval fatigue physically: a status **LCD** and **ambient light** show each agent's state at a glance (`PROCESSING…`, `APPROVE?`, `ERROR`) without taking over your monitor, dedicated **Approve / Deny** buttons let you give a risky action a single deliberate "go," and a **hold-to-talk** button turns speech into the agent's next instruction. Planetz works fully without it — Manta just makes control calmer and more ambient.
- **🌳 Git-native.** Every run is isolated, diffable, and recoverable, because code is treated as a regenerable derivative of intent.

> _Built on open source._ Planetz's harness (shown in-app as **orbit**) adopts the core ideas of the open-source [takt](https://github.com/nrslib/takt) engine and improves on them — adding the deck UI, the intent record, auto workflow routing, edge models, and Manta. Planetz is an independent project, not affiliated with or maintained by the takt authors.

## Next

- [Overview & mental model](../concepts/overview.md) — how all the pieces fit together.
- [The Intent Ledger](../concepts/intent-ledger.md) — the mechanism behind decision governance.
- [Edge AI & data sovereignty](../concepts/edge-ai.md) and [The harness](../concepts/harness-governance.md) — go deeper on the two ideas introduced here.
