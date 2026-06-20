# Workspace & UI overview

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

How the Planetz desktop app is laid out, so you can find any feature quickly. Every later page in this section zooms into one part of this screen.

---

## Open a workspace first

Planetz works on a workspace — a Git repository you open with **Open workspace**. Planetz keeps its own state in a sidecar beside your project and never writes into your existing tool data at runtime (see [Git integration](../concepts/git-integration.md)). On first open it guides you through a short setup (default **Provider** and **Model**).

## The three regions

The deck has three regions:

1. **Left rail — the views.** A vertical rail switches the primary view. The main views are:

   | View | What it's for |
   |---|---|
   | **Task** | Queue and watch work → [Task deck](task-deck.md) |
   | **Issue** | Pull GitHub issues into the queue |
   | **Spec Studio** | Author and trace intent → [Spec Studio](spec-studio.md) |
   | **Decisions** | Review what agents decided → [Decisions](decisions.md) |
   | **Workflows** | Browse the process catalog → [Workflows](workflows.md) |
   | **Log** | Execution log → [Logs & summary](logs-and-summary.md) |
   | **Summary** | Execution summary (outcomes) → [Logs & summary](logs-and-summary.md) |
   | **Adapter** | External agent connections *(Experimental)* |

2. **Center — the active view.** Whatever the rail selects: the task board, a conversation, Spec Studio, and so on.

3. **Panels — the fleet at a glance.** Dockable panels show **Agents** and **Tasks** alongside your work, with **Add task** to enqueue new work. The header has **Workspace**, **View**, **Panels**, and **Reset layout** controls, plus **Settings**.

## The optional companion

If you have the **Manta** desktop robot, it mirrors the same fleet state (working / waiting / approve / error) as ambient light and an LCD, with physical Approve / Deny. Planetz works fully on screen without it. See [Edge AI & data sovereignty](../concepts/edge-ai.md).

## Next

- [Task deck](task-deck.md) — the view you'll spend the most time in.
- [Overview & mental model](../concepts/overview.md) — how these views map to the underlying loop.
