# The harness: govern, don't pre-approve

> Status: Core ideas · Target version 0.1.x

## What you'll learn

What "the harness" actually is, how it picks the right process for each task automatically, and the core stance behind it: **govern outcomes after the fact instead of pre-approving every step.**

---

## What the harness is

Under the hood, Planetz runs agents through a **harness** — the execution engine, shown in-app as **orbit**. The harness is what turns a free-running agent into a *governed* one: it runs each task through a defined **workflow** with explicit roles, steps, and approval points.

Workflows are real, inspectable artifacts:

- **Defined as YAML** — so they can be read, diffed, versioned, and shared.
- **Auditable & reproducible** — the same workflow runs the same way, and you can see exactly what it did.
- **Team assets** — a good process becomes something the whole team owns, not a prompt trapped in one person's chat history.

This is the difference between an assistant with an emergent, private memory and a **process you can govern**.

## The harness picks the right workflow for you

You don't need to know which workflow a task needs. Describe the work, and Planetz **routes it automatically**:

1. It classifies the task from your description (is this an investigation? a fix? does it need deep review? is the implementation already decided?).
2. It scores candidate workflows and selects the best fit.
3. It records **why** it chose that workflow — with a confidence level, the reasons, and the alternatives it considered.
4. You can **override** the choice in a click, and that routing decision is audited.

So the expertise of *how* to run a piece of work moves into the tool — transparently, not as a black box.

## The stance: hindsight over foresight

The deeper idea behind the harness is a deliberate rejection of the usual safety model.

**Pre-approval (foresight) doesn't work.** To approve a step before it runs, you'd have to predict everything that could go wrong. You can't enumerate every failure path, so pre-approval is never complete — and the constant clicking turns you into a rubber stamp. Worse, it forces either airtight specs or full approval onto people who shouldn't need either.

**Planetz invests everything in hindsight instead:**

- Agents **run freely** inside a disposable, [Git-isolated workspace](git-integration.md).
- You **react to outcomes** in plain human terms — *that's wrong / undo / good* — rather than approving steps in advance.
- The decisions you agree with get **locked into the [Intent Ledger](intent-ledger.md)**, so behavior improves over time without you ever doing engineering.

This dissolves the contradiction between "don't chase zero errors" and "still improve": improvement comes from the *recover-and-don't-repeat* loop, not from a perfect gate.

## The one honest gate

"Run freely" holds **inside** the reconstructible zone. The real world has no undo: an email sent, money moved, production deleted — those escape the box.

So the harness keeps exactly one narrow, honest rule rather than a sprawling list of forbidden actions:

> **Actions that leave the reconstructible zone are staged by default.** "Actually send / deploy / delete" becomes its own outcome you confirm deliberately — on a preview — instead of a step buried in an autonomous run.

Planetz tracks how hard each action is to undo, so the deliberate confirmation is reserved for the few actions that truly deserve it. This is exactly where the optional **Manta** desktop robot fits: one physical, unmistakable "go" for the rare irreversible action — instead of one more box to rubber-stamp on screen.

## Promise: contained, visible, recoverable — not "safe"

Planetz does not promise nothing will ever break. That would be a lie — no system prevents every mistake. It promises something honest and more useful:

> Mistakes are **contained** (isolated workspace), **visible** (decisions traced on the deck), and **recoverable** (restore intent, regenerate).

## Built on open source

The harness (orbit) adopts the core ideas of the open-source [takt](https://github.com/nrslib/takt) engine and improves on them — adding the deck UI, the Intent Ledger, automatic workflow routing, edge models, and Manta. Planetz is an independent project, not affiliated with or maintained by the takt authors.

## Next

- [The Intent Ledger](intent-ledger.md) — what the harness records and locks.
- [Workflows](../product/workflows.md) — defining and editing workflows in the product.
- [The standard workflow](../workflow/standard-workflow.md) — the whole loop, end to end.
