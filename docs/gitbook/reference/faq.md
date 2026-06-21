# FAQ

> Status: Reference · Target version 0.1.x

---

### Do I need to be a senior engineer to use Planetz?

No. Planetz is built so the irreducible skill is **recognition** — looking at an outcome and judging whether it's what you wanted — not the ability to write the code yourself. You govern by approving or rejecting decisions in plain terms; the engineering of *how* runs are configured moves into the tool. See [Why Planetz is different](../why/how-planetz-is-different.md).

### Does my source code leave my machine?

It doesn't have to. Planetz can run inference on a **local model via Ollama**, so source code and internal docs stay on your machine and aren't sent to a public API. The honest limit: some tool-using workflow steps may still use a cloud provider, and you choose where each step runs. See [Edge AI & data sovereignty](../concepts/edge-ai.md).

### Can I use Planetz without Manta?

Yes. Planetz Agent Deck is a full desktop app on its own — you approve and operate from the screen. **Manta** is optional hardware for calmer, more physical, ambient control.

### What happens when an agent makes a mistake?

Planetz doesn't promise mistakes never happen — no system can. It makes them **contained** (each run is isolated in Git), **visible** (decisions and drift surface on the deck, not after release), and **recoverable** (restore your intent and regenerate). Truly irreversible actions — deploy, send, delete — are staged for a deliberate confirmation. See [The harness](../concepts/harness-governance.md).

### Is Planetz based on takt?

Yes — and we're glad to say so. Planetz's harness (shown in-app as **orbit**) adopts the core ideas of the open-source [takt](https://github.com/nrslib/takt) engine and improves on them, adding the deck UI, the Intent Ledger, automatic workflow routing, edge models, and Manta. Planetz is an **independent project**, not affiliated with or maintained by the takt authors.

### How do the local Deck and Planetz Cloud relate?

They share the same deck UX and workflows. Teams can start locally on edge models and move workspaces to **Cloud** for more power and team features (sharing, audit logs) without relearning the product. See [What's next](../roadmap/whats-next.md).

### Can I bring my own agents, like Cursor?

Yes. External agents can join the deck through an **adapter** and have their status governed alongside built-in agents. External adapters are currently **Experimental**. See [Settings & integrations](../product/settings.md).

### Where is my data stored?

In your workspace. Planetz keeps its own state in a managed folder beside your project and does not write into your existing tool data at runtime. Combined with edge models, the sensitive parts — your code, decisions, and approvals — stay under your control. See [Git integration](../concepts/git-integration.md).

### Won't smarter models make this unnecessary?

The opposite. The smarter a model gets, the **more it decides silently on your behalf** — so loss of provenance and drift get worse, not better. Keeping intent, decisions, and comprehension under your control matters *more* as agents get more capable, not less.

### Is Planetz open source?

There's an open-source build you can try. See [planetz-release on GitHub](https://github.com/guilz-dev/planetz-release).

## Still stuck?

- [Glossary](glossary.md) — definitions for any unfamiliar term.
- [The standard workflow](../workflow/standard-workflow.md) — how a piece of work moves through Planetz end to end.
