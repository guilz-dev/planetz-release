/** Minimal inline fixtures for takt-default form mode (no third_party file reads). */

export const TAKT_DEFAULT_MINIMAL_YAML = `name: takt-default-minimal
initial_step: plan
steps:
  - name: plan
    persona: planner
    provider_options:
      claude:
        allowed_tools:
          - Read
    rules:
      - condition: ok
        next: write_tests
    output_contracts:
      report:
        - format: plan
          use_judge: false
  - name: write_tests
    persona: coder
    rules:
      - condition: done
        next: draft
        requires_user_input: true
        interactive_only: true
  - name: draft
    kind: workflow_call
    call: draft
    rules:
      - condition: COMPLETE
        next: supervise
  - name: supervise
    persona: supervisor
    instruction: supervise
    rules:
      - condition: ok
        next: COMPLETE
`

/** Inline stand-in for Planetz builtin `default` (full form, no special steps). */
export const BUILTIN_DEFAULT_MINIMAL_YAML = `name: default
initial_step: plan
max_steps: 10
personas:
  planner: ../facets/personas/planner.md
  coder: ../facets/personas/coder.md
  reviewer: ../facets/personas/reviewer.md
steps:
  - name: plan
    persona: planner
    rules:
      - condition: Planning complete
        next: implement
  - name: implement
    persona: coder
    rules:
      - condition: Implementation complete
        next: review
  - name: review
    persona: reviewer
    rules:
      - condition: Approved
        next: COMPLETE
`

export const LEGACY_WORKFLOW_CALL_YAML = `name: legacy-wfc
initial_step: draft
steps:
  - name: draft
    call: draft
    rules:
      - condition: COMPLETE
        next: COMPLETE
`

/** Excerpt mirroring builtin `default-draft` (no special steps; YAML-only before Phase 1). */
export const DEFAULT_DRAFT_MINIMAL_YAML = `name: default-draft-minimal
description: Phase 1 fixture
subworkflow:
  callable: true
  visibility: internal
  returns:
    - need_replan
  params:
    impl_instruction:
      type: facet_ref
      facet_kind: instruction
      default: implement
initial_step: implement
max_steps: 30
steps:
  - name: implement
    edit: true
    persona: coder
    policy:
      - coding
      - testing
    knowledge:
      - architecture
    instruction:
      $param: impl_instruction
    rules:
      - condition: Implementation complete
        next: review
      - condition: Cannot proceed, insufficient info
        return: need_replan
      - condition: User input required
        next: implement
        requires_user_input: true
        interactive_only: true
    output_contracts:
      report:
        - name: coder-scope.md
          format: coder-scope
  - name: review
    persona: reviewer
    rules:
      - condition: Approved
        next: COMPLETE
`

export const TAKT_REFRESH_FAST_MINIMAL_YAML = `name: takt-refresh-minimal
initial_step: plan
steps:
  - name: plan
    persona: planner
    session: refresh
    provider_options:
      claude:
        allowed_tools:
          - Read
    rules:
      - condition: ok
        next: COMPLETE
  - name: call-step
    kind: workflow_call
    call: draft
    rules:
      - condition: COMPLETE
        next: COMPLETE
`
