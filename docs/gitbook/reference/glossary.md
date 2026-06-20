# Glossary

> Status: Reference · Target version 0.1.x

Short definitions for the terms used across this documentation. Each links to a fuller explanation where one exists.

---

**Planetz / Planetz Agent Deck** — the desktop app for running and governing a fleet of AI agents.

**Deck** — the main screen: left rail of views, a center view, and dockable panels.

**Harness** — the execution engine that turns a free-running agent into a governed one by running it through a defined workflow. Shown in-app as **orbit**. → [The harness](../concepts/harness-governance.md)

**orbit** — the in-product display name for the harness, and for Planetz's per-workspace settings.

**Workspace** — the Git repository you open in Planetz. Planetz keeps its own state in a managed folder beside your project and doesn't write into your existing tool data at runtime. → [Git integration](../concepts/git-integration.md)

**Fleet** — the set of agents working in parallel, each in its own lane. → [Multi-agent fleet](../concepts/multi-agent.md)

**Agent roles** — specialized agents such as planner, coder, reviewer, and tester (maker–checker separation).

**Lane** — a task's isolated branch and workspace, so parallel agents don't collide.

**Task / Run** — a *task* is a unit of work you queue; a *run* is one execution of it.

**Workflow** — the process a run follows (steps, roles, approval points), defined as YAML so it's auditable, versioned, and shareable. → [Workflows](../product/workflows.md)

**Auto routing** — the harness classifying a task and selecting the right workflow automatically, with the reasoning recorded.

**Facet** — a reusable building block (persona, policy, knowledge, instruction) that workflows draw on.

**Intent Ledger** — the durable record of what was decided, its provenance, and whether it still matches what you wanted; the source of truth that code answers to. → [The Intent Ledger](../concepts/intent-ledger.md)

**Decided intent** — what you want, why, and what's out of scope, captured in [Spec Studio](../product/spec-studio.md).

**Decision** — a choice an agent made during a run, recorded with its provenance and links to your intent.

**Provenance** — where a decision came from: your requirement, a design choice, an agent's assumption, or something observed after the fact.

**Anchored / Unanchored** — a decision is *anchored* when it traces to your requirements or design; *unanchored* when it traces to nothing — the signature of drift.

**Drift** — when implementation moves away from what you decided, usually through many small, unreconciled decisions.

**Approve / Reject (ratify / reverse)** — your verdict on a decision; once given, it's locked so a later run can't silently overwrite it.

**Reversibility** — how hard an action is to undo; drives where a deliberate confirmation is worth it.

**Edge model** — a model running locally on your machine (via **Ollama**) so your code never leaves for a public API. → [Edge AI & data sovereignty](../concepts/edge-ai.md)

**Manta** — the optional desktop robot: status LCD, ambient light, physical Approve / Deny, and push-to-talk.

**Planetz Cloud** — a managed private node with the same deck and workflows, for more power and team features. → [What's next](../roadmap/whats-next.md)

**MCP** — Model Context Protocol; how external tools and servers connect to Planetz.

**Adapter / external agent** — connection that lets an outside agent (e.g. Cursor) join the deck. *(Experimental.)*

**takt** — the open-source engine whose core ideas Planetz's harness (orbit) adopts and builds on. Planetz is an independent project. → [How Planetz is different](../why/how-planetz-is-different.md)
