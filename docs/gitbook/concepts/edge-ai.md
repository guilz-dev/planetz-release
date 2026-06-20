# Edge AI & data sovereignty

> Status: Core ideas · Target version 0.1.x

## What you'll learn

How Planetz can run AI **on your own machine** so your source code never has to leave for a public API — what that buys you, where the honest limits are, and how you scale up when you need more power.

---

## Your code is your most sensitive asset

Most AI coding tools send your source and internal docs to a cloud API. For many teams that's a non-starter: the code *is* the crown jewels, and parking it (or your API keys) in someone else's SaaS is exactly what security and compliance won't allow.

Planetz treats this as a first-class concern: **data sovereignty**, not an afterthought.

## Edge models: inference on your machine

Planetz can connect to a **local model via Ollama**, so inference runs on hardware you control. In practice that means:

- **Privacy & security** — source code and internal docs stay on your machine; nothing is sent to an external API for inference.
- **Offline-capable** — where local models allow, you can keep working without a connection (e.g. on a plane).
- **No keys in someone else's cloud** — real control over where your data and credentials live.

From Settings you can point Planetz at your Ollama instance, test the connection, see model health, and pull or remove models directly.

## The honest limit

Edge AI is powerful, but we won't oversell it:

> **Inference runs on your machine. Some tool-using workflow steps still need a cloud provider.** Local models today don't cover every capability (for example, certain tool-execution steps), so a workflow can mix local and cloud per step — and you choose where each step runs.

This keeps the privacy win real without pretending local models do everything yet.

## Scale up without relearning

Edge-first doesn't mean edge-only. Planetz is designed as a spectrum:

- **Desktop (Edge)** — local inference via Ollama, plus optional Manta and local speech-to-text.
- **Planetz Cloud** — a managed private node you can drive from the browser, with the **same deck UX and workflows**. Teams can start locally and move workspaces to Cloud without learning a new product.

The point is continuity: the way you queue tasks, govern decisions, and approve work is identical whether the model is on your laptop or in a private cloud node.

## How this connects to the rest of Planetz

Data sovereignty and the [Intent Ledger](intent-ledger.md) reinforce each other: your code stays on your machine *and* the record of what you decided stays under your control. Combined with the optional **Manta** desktop robot for ambient, physical control, Planetz is built so that the sensitive parts of agentic development — your code, your decisions, your approvals — never have to leave your hands.

## Next

- [Git integration & disposable workspaces](git-integration.md) — where the code and run data actually live.
- [Settings & integrations](../product/settings.md) — configure Ollama, models, and providers.
