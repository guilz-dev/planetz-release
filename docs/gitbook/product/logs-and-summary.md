# Execution logs & summary

> Status: The product · Target version 0.1.x ｜ Verify labels against your build

## What you'll learn

The two views that let you follow what actually happened: **Log** for the detailed event stream of a run, and **Summary** for outcomes across many runs.

---

## Log — the detailed event stream

The **Execution log** view shows run events as they happen. You can search the log and filter by **time window**, **event type**, **task status**, and **executor**. Use it when you want to see exactly what an agent did, step by step — its plan, its actions, and where it is in the workflow.

> The point is that comprehension stays with you, not buried inside the model. You can always answer *"what is this agent doing right now, and why?"*

## Summary — outcomes at a glance

The **Execution summary** view rolls up **task-level outcomes** for completed runs in a selected time window. Use it to see how the fleet is doing overall — what succeeded, what failed, and where attention is needed — rather than reading every individual log.

## How they fit the loop

Logs and summary are your window into the **hindsight** half of Planetz: agents run freely, and you react to what actually happened. Together with [Decisions](decisions.md), they turn a run from a black box into something you can review, judge, and learn from. See [The harness](../concepts/harness-governance.md).

## Next

- [Decisions](decisions.md) — review the specific calls a run made.
- [Task deck](task-deck.md) — where runs start.
