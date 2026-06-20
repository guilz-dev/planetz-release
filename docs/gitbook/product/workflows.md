# Workflows

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

What a workflow is, how Planetz picks one for you automatically, and where to browse or author your own.

---

## What a workflow is

A workflow is the **process** an agent run follows — its steps, roles, and the points where a human must approve. Workflows are defined as **YAML**, so they can be read, diffed, versioned, and shared. That's what makes a Planetz process auditable and reproducible, rather than a prompt trapped in one chat. See [The harness](../concepts/harness-governance.md).

## Automatic selection

You usually don't choose a workflow by hand. With **Auto** mode, Planetz reads your task description, classifies it, and **routes it to the right workflow** — showing a routing preview with the match and its reasoning. You can always switch to a specific workflow, and your choice is recorded.

## The catalog

Workflows live in a catalog (under **Settings**), grouped so you can find and manage them:

- **Core** — built-in workflows that ship with Planetz.
- **Library** — additional packs you can enable.
- **Project / User** — your own workflows, saved as YAML in the workspace and editable.

You can search, pin a workflow into the picker, hide one, or copy a core/library workflow into your project to edit it as YAML.

## Human approval gates

Workflows are where you define **where a human must approve** — before risky steps like deploy or delete. This is the harness's one honest gate: irreversible, real-world actions are staged for a deliberate confirmation (optionally a physical one via **Manta**), while reversible work runs freely. See [The harness](../concepts/harness-governance.md).

## Next

- [The standard workflow](../workflow/standard-workflow.md) — the end-to-end loop these pieces form.
- [Settings & integrations](settings.md) — where the catalog and providers are configured.
