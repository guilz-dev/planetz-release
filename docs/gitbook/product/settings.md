# Settings & integrations

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

Where to configure Planetz for your workspace — models (including **edge** models), the catalog, agents, and external integrations.

---

## The Settings tabs

Settings configures the workspace you have open:

| Tab | What you set |
|---|---|
| **General** | UI preferences |
| **Providers** | Which model providers are allowed in this workspace |
| **Facets** | Reusable persona / policy / knowledge building blocks for workflows |
| **Orbit config** | Engine defaults — the default **Provider** and **Model** used to run tasks |
| **Agents** | Agent roles and runtimes |
| **Integrations** | External connections (MCP servers, adapters) |

On first run, a short setup asks for your default provider and model; you can change them anytime under **Orbit config**.

## Edge models (data sovereignty)

Under provider configuration you can connect a **local Ollama** instance so inference runs on your own machine — test the connection, check model health, and pull or remove models. This keeps source code and internal docs off public APIs. Note the honest limit: some tool-using workflow steps may still use a cloud provider. See [Edge AI & data sovereignty](../concepts/edge-ai.md).

## Integrations & external agents

**Integrations** is where you connect outside tools — including MCP servers, and adapters that let **external agents** (for example Cursor) join the deck. Registered secrets are stored with your system's secure storage when available.

> External adapters are **Experimental** and evolving; expect rough edges.

## Next

- [Edge AI & data sovereignty](../concepts/edge-ai.md) — the why behind local models.
- [Workflows](workflows.md) — the catalog configured alongside these settings.
