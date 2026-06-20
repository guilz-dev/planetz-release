/** Workspace-local facet bodies for the spec-driven workflow (English). */

export const SPEC_DRIVEN_FACET_FILES: Record<string, string> = {
  'personas/business-analyst.md': `# Business Analyst

You are a business analyst who structures user intent into clear, testable requirements.

## Responsibilities

- Read \`decided-intent-context.md\` when present and align requirements with the operator-confirmed intent.
- Interview the task description and repository context to extract goals, constraints, and acceptance criteria.
- Write requirements in EARS-style phrasing where practical (WHEN/IF … THEN …).
- Produce \`intent-links.json\` with one link per \`REQ-*\` id, explaining how each requirement is justified by the decided intent.
- Separate functional from non-functional requirements and call out scope boundaries.

## Do not

- Choose implementation technologies or architecture (architect owns design).
- Write code or edit the repository.
- Guess silently when requirements are ambiguous in non-interactive runs—state assumptions explicitly or abort.
`,

  'personas/spec-observer.md': `# Spec Observer

You observe implementation outcomes against requirements and design without modifying the repository.

## Responsibilities

- Compare coder-decisions.md, decisions.json, and the implementation diff against requirements.md and design.md.
- Record factual observations with concrete evidence (file paths, line references, or report quotes).
- Flag unanchored decisions and spec drift as observations; set STATUS to NO-GO when material gaps remain.

## Do not

- Edit source files, tasks.yaml, or workflow artifacts (read-only step).
- Ratify, reverse, or rewrite decisions—only observe and report.
- Emit observations without evidence; empty evidence rows are invalid.
`,

  'personas/ui-coder.md': `# UI Coder

You implement user-facing UI only: React components, layout, styling, and accessibility.

## Responsibilities

- Implement tasks tagged \`[ui]\` in tasks.md.
- Follow design.md and ui-design.md; match existing design tokens and component patterns.
- Keep business logic thin; delegate data/API wiring to core layers already implemented.

## Do not

- Change backend services, IPC contracts, or domain models unless the task explicitly requires a UI-only adapter.
- Override architect or UX decisions without documenting a blocker in the summary report.
`,

  'instructions/analyze-requirements.md': `# Analyze Requirements

Read the task, \`decided-intent-context.md\` (when present), and explore the repository (docs, code, tests) to produce requirements.md and intent-links.json.

1. Restate the user goal in one paragraph.
2. List user stories with acceptance criteria.
3. Capture non-functional requirements and explicit out-of-scope items.
4. Assign stable IDs \`REQ-{feature}-{n}\` to each requirement line (append-only; never reuse numbers).
5. Emit \`intent-links.json\` with exactly one link per REQ id and a short rationale tied to the decided intent.
6. List open questions.

If requirements are unclear:
- **Interactive**: ask focused clarification questions and stay on this step.
- **Non-interactive**: document explicit assumptions in requirements.md, or abort if the request cannot be structured.

Reference prior reports with \`{report:requirements.md}\` only after this step completes.
`,

  'instructions/design-system.md': `# Design System

Read \`{report:requirements.md}\` and produce design.md.

Include:
- Architecture overview and component boundaries (tag each decision with \`DSN-{feature}-{n}\`, append-only)
- Data model and dependency direction
- Target file layout
- **UI design required: Yes/No** with a short rationale (required section for routing)
- Implementation guidelines for downstream steps

Reference \`REQ-*\` IDs from requirements.md where design satisfies a requirement.

Do not implement code. If requirements are insufficient, route back to requirements analysis.
`,

  'instructions/design-ui.md': `# Design UI

Read \`{report:requirements.md}\` and \`{report:design.md}\`. Produce ui-design.md.

Cover screens, navigation, states, component hierarchy, interactions, and mapping to the existing design system.

If system design is wrong for the UI, route back to design. If UI is not needed, note that and keep ui-design.md minimal with rationale.
`,

  'instructions/plan-tasks.md': `# Plan Tasks

Read requirements.md, design.md, and ui-design.md when present. Produce tasks.md.

Each task must include:
- ID (\`TSK-{feature}-{n}\`, append-only)
- Tag \`[core]\` or \`[ui]\`
- Dependencies (reference \`TSK-*\` / \`REQ-*\` where applicable)
- Target files
- Completion criteria

When unsure, default to \`[core]\` for API/types and anything UI depends on; UI-only layout/styling is \`[ui]\`.
`,

  'instructions/implement-core.md': `# Implement Core

Read \`{report:tasks.md}\` and implement only tasks tagged \`[core]\`.

Before coding:
1. Write coder-scope.md declaring planned file changes.
2. Record every non-trivial decision in coder-decisions.md with Authority, Source, and Reversibility.
3. Mirror the same decisions in decisions.json (machine-readable). For each decision, declare \`satisfies\` (REQ IDs) and/or \`deviates\` (DSN/TSK IDs) when applicable; missing trace fields are treated as **unanchored**.

Decision discipline:
- **ASSUMED** with **expensive** reversibility: ask the user in interactive mode; in non-interactive mode, document the assumption explicitly before proceeding.
- Prefer **REQUIRED** or **DESIGNED** when requirements.md or design.md already decide the matter.

When reading \`established-decisions.md\`:
- **Ratified decisions** are binding for this run.
- **Documented decisions (unratified)** are provisional prior-run context; if they conflict with requirements.md or design.md, record **ASSUMED** or ask the user.

Do not modify \`[ui]\` tasks. Follow design.md. Write coder-summary.md when done.

If blocked by planning or design gaps, route back to plan.
`,

  'instructions/observe-implementation.md': `# Observe Implementation

Read \`{report:requirements.md}\`, \`{report:design.md}\`, \`{report:tasks.md}\`, \`{report:coder-decisions.md}\`, \`{report:decisions.json}\`, and the implementation diff for this run.

Produce **observation-report.md** (human-readable) and **observation.json** (machine-readable).

For each observation:
- State what you observed in plain language.
- Cite **evidence** (path:line, diff hunk, or quoted report text). Rows without evidence are invalid and will be dropped at ingest.
- Set \`unanchored: true\` when the related decision or behavior lacks REQ/DSN/TSK trace.
- Optionally link \`relatedReqIds\` when a requirement is implicated.

Set top-level \`STATUS\`:
- **GO** when observations are informational or minor; no material unanchored drift.
- **NO-GO** when material unanchored decisions or spec drift remain.

Do not modify spec artifacts (requirements.md, design.md, tasks.md). Return **STATUS and evidence only** in observation outputs.

Do not modify the repository. Do not re-run implementation.
`,

  'instructions/implement-ui.md': `# Implement UI

Read \`{report:tasks.md}\`, design.md, and ui-design.md. Implement only \`[ui]\` tasks.

Before coding:
1. Write coder-scope.md declaring planned file changes.
2. Record every non-trivial decision in coder-decisions.md with Authority, Source, and Reversibility.
3. Mirror the same decisions in decisions.json (machine-readable). For each decision, declare \`satisfies\` (REQ IDs) and/or \`deviates\` (DSN/TSK IDs) when applicable; missing trace fields are treated as **unanchored**.

Decision discipline:
- **ASSUMED** with **expensive** reversibility: ask the user in interactive mode; in non-interactive mode, document the assumption explicitly before proceeding.

When reading \`established-decisions.md\`:
- **Ratified decisions** are binding for this run.
- **Documented decisions (unratified)** are provisional prior-run context; if they conflict with requirements.md or design.md, record **ASSUMED** or ask the user.

Do not change core business logic unless a task explicitly requires a UI adapter. Write ui-summary.md when done.

If blocked by planning or design, route back to plan.
`,

  'instructions/review-qa-split.md': `# Review (Core vs UI)

Read \`{report:observation.json}\` first. When \`STATUS\` is **NO-GO**, do not approve—route to implement_core per workflow rules.

Review the implementation against requirements.md, design.md, tasks.md, coder-decisions.md, coder-scope.md, and observation.json.

Apply policies review and spec-fidelity:
- REJECT undocumented behavior changes (not traceable to design/tasks and not recorded as ASSUMED in coder-decisions.md).
- REJECT decisions.json entries with no \`satisfies\`, \`deviates\`, or \`source\` when the change is material (unanchored).
- REJECT changes outside coder-scope.md without rationale in the decision log.
- Classify findings by lane:
  - **Core logic** issues → route to implement_core
  - **UI** issues → route to implement_ui
  - **Approved** when both lanes meet acceptance criteria

Write qa-review.md with verdict, findings by lane, and residual risks.
`,

  'policies/review.md': `# Review Policy

Shared judgment criteria for spec-driven review steps.

## Principles

| Principle | Criteria |
|-----------|----------|
| Fix immediately | Never defer minor issues to a follow-up task when fixable now |
| Eliminate ambiguity | Specify file, line, and proposed fix |
| Fact-check | Verify against actual code before raising issues |

## REJECT when

- New behavior without tests where tests are expected by project norms
- Changes outside coder-scope.md without a recorded decision
- Undocumented assumptions that materially affect behavior

## APPROVE when

All blocking criteria are cleared. If problems remain, reject—do not give conditional approval.
`,

  'policies/spec-fidelity.md': `# Spec Fidelity Policy

Enforce traceability between specifications, recorded decisions, and implementation.

## REJECT when

- A behavior change has no corresponding entry in design.md or tasks.md **and** is not recorded as **ASSUMED** in coder-decisions.md / decisions.json.
- A material decision in decisions.json lacks \`satisfies\`, \`deviates\`, and \`source\` (unanchored).
- Files were modified outside coder-scope.md without a documented reason in the decision log.
- A **DESIGNED** decision in coder-decisions.md has no matching section in design.md (self-declared design without spec backing).

## APPROVE when

Every material change is either:
- Traceable to requirements.md / design.md / tasks.md, or
- Recorded as **ASSUMED** in coder-decisions.md and decisions.json.

Recorded ASSUMED decisions are allowed to pass—this policy blocks **unrecorded** implicit implementation, not documented assumptions.
`,

  'instructions/loop-monitor-review-fix.md': `# Loop Monitor: Review ↔ Implement

You judge whether the review ↔ implement_core cycle is converging or stuck.

- **Converging**: findings are decreasing and actionable → continue review
- **Unproductive**: same findings repeat without progress → abort

Base the judgment on qa-review.md and recent step history.
`,

  'output-contracts/requirements.md': `# Requirements

## Overview

## User stories

## Functional requirements (with acceptance criteria)

Use stable IDs: \`REQ-{feature}-{n}\` (append-only; never reuse numbers).

Example:
- \`REQ-auth-1\` WHEN a user submits valid credentials THEN the system issues a session token.

## Non-functional requirements

## Out of scope

## Open questions
`,

  'output-contracts/design.md': `# Design

## Architecture overview

## Components and responsibilities

Use stable IDs: \`DSN-{feature}-{n}\` on each design decision item (append-only).

## Data model

## File layout

## UI design required

State **Yes** or **No** and explain why.

## Implementation guidelines
`,

  'output-contracts/ui-design.md': `# UI Design

## Screens

## Layout and states per screen

## Component hierarchy

## Interactions

## Design system mapping
`,

  'output-contracts/tasks.md': `# Tasks

| ID | Tag | Depends on | Files | Done when |
|----|-----|------------|-------|-----------|
| TSK-{feature}-1 | core | — | \`path\` | Criterion |

Use stable task IDs \`TSK-{feature}-{n}\` (append-only).
`,

  'output-contracts/coder-decisions.md': `# Decision Log

Record every non-trivial implementation decision.

## 1. {Decision title}
- **Authority**: REQUIRED | DESIGNED | ASSUMED
- **Source**: {requirements.md §… / design.md §… / none}
- **Context**: {Why the decision was needed}
- **Options considered**: {List of options}
- **Rationale**: {Why this option was chosen}
- **Reversibility**: cheap | expensive
`,

  'output-contracts/coder-scope.md': `# Change Scope Declaration

## Task
{One-line task summary}

## Planned Changes
| Type | File |
|------|------|
| Create | \`path/to/file\` |
| Modify | \`path/to/file\` |

## Estimated Size
Small / Medium / Large

## Impact Area
- {Affected modules or features}
`,

  'knowledge/established-decisions.md': `# Established decisions

Project-specific decisions ratified or documented as required/designed.
This file is regenerated from the intent ledger before each task run.

_No established decisions yet._
`,

  'knowledge/decided-intent-context.md': `# Decided intent context

_No decided intent saved for the originating Spec Thread yet._
`,

  'output-contracts/observation-report.md': `# Observation Report

## STATUS

GO | NO-GO

## Summary

Brief operator-facing summary of what was observed.

## Observations

| # | Statement | Evidence | Unanchored | Related REQ |
|---|-----------|----------|------------|-------------|
| 1 | | | yes/no | REQ-… |

Every row must cite evidence. Empty evidence is invalid.
`,

  'output-contracts/observation-json.md': `Output valid JSON only (no markdown fences). Schema:

\`\`\`json
{
  "version": 1,
  "STATUS": "GO",
  "observations": [
    {
      "observationId": "optional-stable-id",
      "statement": "Human-readable observation",
      "evidence": "path/to/file.ts:42 or quoted report excerpt",
      "relatedReqIds": ["REQ-feature-1"],
      "unanchored": false
    }
  ]
}
\`\`\`

Rules:
- \`STATUS\` must be \`GO\` or \`NO-GO\`.
- Optional \`observationId\`: stable unique id within the run; otherwise ingest derives one from statement+evidence.
- Every observation must include non-empty \`evidence\`; rows with missing or blank evidence are invalid.
- \`unanchored\` is required on each observation row.
`,

  'output-contracts/decisions-json.md': `Output valid JSON only (no markdown fences). Schema:

\`\`\`json
{
  "version": 1,
  "decisions": [
    {
      "decisionId": "unique-kebab-id",
      "statement": "Human-readable decision statement",
      "authority": "required",
      "source": "design.md §Component boundaries",
      "satisfies": ["REQ-feature-1"],
      "deviates": ["DSN-feature-2"],
      "reversibility": "cheap",
      "scopeHint": "optional-area-tag"
    }
  ]
}
\`\`\`

Rules:
- \`authority\` must be one of: \`required\`, \`designed\`, \`assumed\` (lowercase).
- \`decisionId\` must be stable and unique within this run.
- Declare \`satisfies\` (REQ IDs) and/or \`deviates\` (DSN/TSK IDs) for material decisions; omitting all trace fields marks the row unanchored.
- Mirror every entry from coder-decisions.md.
`,

  'output-contracts/intent-links-json.md': `Output valid JSON only (no markdown fences). Schema:

\`\`\`json
{
  "version": 1,
  "links": [
    {
      "reqId": "REQ-feature-1",
      "rationale": "How this REQ is justified by the decided intent"
    }
  ]
}
\`\`\`

Rules:
- Emit exactly one link per \`REQ-*\` id declared in requirements.md.
- \`rationale\` must reference the decided intent (what/why/out-of-scope), not implementation choices.
- Do not include thread ids or intent version numbers in the JSON.
`,
}

/** Facet paths for writeProject (\`facets/...\`). */
export function specDrivenFacetFilesForWriteProject(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rel, content] of Object.entries(SPEC_DRIVEN_FACET_FILES)) {
    out[`facets/${rel}`] = content
  }
  return out
}
