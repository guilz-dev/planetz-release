import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { SPEC_DRIVEN_INSTALLER_SENTINEL } from './spec-driven-installer-version.js'

export const SPEC_DRIVEN_WORKFLOW_YAML = `${SPEC_DRIVEN_INSTALLER_SENTINEL}
name: ${SPEC_DRIVEN_WORKFLOW_NAME}
description: >
  Spec-driven development: business analyst writes requirements, architect
  designs the system, ux-designer designs screens when needed, planner breaks
  work into tagged tasks, then coder and ui-coder implement their lanes.
initial_step: analyze_requirements
max_steps: 30
loop_monitors:
  - cycle:
      - review
      - implement_core
    threshold: 3
    judge:
      persona: qa-reviewer
      instruction: loop-monitor-review-fix
      rules:
        - condition: Converging (findings decreasing)
          next: review
        - condition: Unproductive (same findings repeating)
          next: ABORT
personas:
  business-analyst: ../facets/personas/business-analyst.md
  architect: ../facets/personas/architect.md
  ux-designer: ../facets/personas/ux-designer.md
  planner: ../facets/personas/planner.md
  coder: ../facets/personas/coder.md
  ui-coder: ../facets/personas/ui-coder.md
  spec-observer: ../facets/personas/spec-observer.md
  qa-reviewer: ../facets/personas/qa-reviewer.md
policies:
  coding: ../facets/policies/coding.md
  review: ../facets/policies/review.md
  spec-fidelity: ../facets/policies/spec-fidelity.md
knowledge:
  architecture: ../facets/knowledge/architecture.md
  established-decisions: ../facets/knowledge/established-decisions.md
  decided-intent-context: ../facets/knowledge/decided-intent-context.md
instructions:
  analyze-requirements: ../facets/instructions/analyze-requirements.md
  design-system: ../facets/instructions/design-system.md
  design-ui: ../facets/instructions/design-ui.md
  plan-tasks: ../facets/instructions/plan-tasks.md
  implement-core: ../facets/instructions/implement-core.md
  implement-ui: ../facets/instructions/implement-ui.md
  observe-implementation: ../facets/instructions/observe-implementation.md
  review-qa-split: ../facets/instructions/review-qa-split.md
  loop-monitor-review-fix: ../facets/instructions/loop-monitor-review-fix.md
report_formats:
  requirements: ../facets/output-contracts/requirements.md
  design: ../facets/output-contracts/design.md
  ui-design: ../facets/output-contracts/ui-design.md
  tasks: ../facets/output-contracts/tasks.md
  summary: ../facets/output-contracts/summary.md
  qa_review: ../facets/output-contracts/qa-review.md
  coder_decisions: ../facets/output-contracts/coder-decisions.md
  coder_scope: ../facets/output-contracts/coder-scope.md
  decisions_json: ../facets/output-contracts/decisions-json.md
  observation_report: ../facets/output-contracts/observation-report.md
  observation_json: ../facets/output-contracts/observation-json.md
  intent_links_json: ../facets/output-contracts/intent-links-json.md
steps:
  - name: analyze_requirements
    persona: business-analyst
    instruction: analyze-requirements
    knowledge:
      - architecture
      - decided-intent-context
    edit: false
    output_contracts:
      report:
        - name: requirements.md
          format: requirements
        - name: intent-links.json
          format: intent_links_json
    rules:
      - condition: Requirements are clear and documented
        next: design
      - condition: Clarification needed from the user
        next: analyze_requirements
        requires_user_input: true
        interactive_only: true
      - condition: Request cannot be turned into requirements
        next: ABORT

  - name: design
    persona: architect
    instruction: design-system
    policy: coding
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: design.md
          format: design
    rules:
      - condition: Design complete and UI design is required
        next: ui_design
      - condition: Design complete and no UI design is needed
        next: plan
      - condition: Requirements are insufficient for design
        next: analyze_requirements

  - name: ui_design
    persona: ux-designer
    instruction: design-ui
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: ui-design.md
          format: ui-design
    rules:
      - condition: UI design complete
        next: plan
      - condition: System design needs revision
        next: design
      - condition: UI design is not required
        next: plan

  - name: plan
    persona: planner
    instruction: plan-tasks
    policy: coding
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: tasks.md
          format: tasks
    rules:
      - condition: Task breakdown complete
        next: implement_core
      - condition: Design has gaps that block planning
        next: design

  - name: implement_core
    persona: coder
    instruction: implement-core
    policy: coding
    knowledge:
      - architecture
      - established-decisions
    edit: true
    required_permission_mode: edit
    session: refresh
    output_contracts:
      report:
        - name: coder-scope.md
          format: coder_scope
        - name: coder-decisions.md
          format: coder_decisions
        - name: decisions.json
          format: decisions_json
        - name: coder-summary.md
          format: summary
    rules:
      - condition: Core tasks complete and UI tasks remain
        next: implement_ui
      - condition: Core tasks complete and there are no UI tasks
        next: observe
      - condition: No core tasks in tasks.md
        next: implement_ui
      - condition: Blocked by a planning or design problem
        next: plan

  - name: implement_ui
    persona: ui-coder
    instruction: implement-ui
    policy: coding
    knowledge:
      - architecture
      - established-decisions
    edit: true
    required_permission_mode: edit
    session: refresh
    output_contracts:
      report:
        - name: coder-scope.md
          format: coder_scope
        - name: coder-decisions.md
          format: coder_decisions
        - name: decisions.json
          format: decisions_json
        - name: ui-summary.md
          format: summary
    rules:
      - condition: UI tasks complete
        next: observe
      - condition: Blocked by a planning or design problem
        next: plan

  - name: observe
    persona: spec-observer
    instruction: observe-implementation
    policy: spec-fidelity
    knowledge: architecture
    edit: false
    pass_previous_response: false
    output_contracts:
      report:
        - name: observation-report.md
          format: observation_report
        - name: observation.json
          format: observation_json
    rules:
      - condition: Observation complete
        next: review

  - name: review
    persona: qa-reviewer
    instruction: review-qa-split
    policy:
      - review
      - spec-fidelity
    knowledge: architecture
    edit: false
    pass_previous_response: false
    output_contracts:
      report:
        - name: qa-review.md
          format: qa_review
    rules:
      - condition: Observation status is NO-GO
        next: implement_core
      - condition: Approved
        next: COMPLETE
      - condition: Core logic needs fixes
        next: implement_core
      - condition: UI needs fixes
        next: implement_ui
`
