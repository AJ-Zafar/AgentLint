---
title: AgentSpec YAML reference
---

# AgentSpec YAML reference

AgentSpec files use YAML and typically end with `.agentspec.yaml` or `.agentspec.yml`.

The current format is intentionally explicit. It separates identity, persona, instructions, constraints, tools, routes, handoffs and tests so that each concern can be validated and reviewed independently.

## Top-level structure

```yaml
agent: {}
persona: {}
instructions: {}
constraints: {}
tools: []
routes: []
handoffs: []
tests: []
```

## `agent`

Describes the agent as an owned artefact.

```yaml
agent:
  name: Customer Support Triage Agent
  description: Routes customer support requests to approved workflows.
  version: 1.0.0
  owner: support-operations
  domain: customer-support
```

Fields:

- `name`: human-readable name
- `description`: short purpose statement
- `version`: version of the spec or agent design
- `owner`: responsible team or person
- `domain`: business or technical domain

## `persona`

Describes the role and communication style expected of the agent.

```yaml
persona:
  role: Policy-grounded support triage assistant
  tone: calm and professional
  verbosity: concise
  style_rules:
    - Use plain language.
    - Explain when human review is required.
```

## `instructions`

Defines intended behaviour.

```yaml
instructions:
  primary_goal: Classify requests and choose the safest approved route.
  secondary_goals:
    - Collect only required account context.
  do:
    - Use declared routes before answering.
  do_not:
    - Do not request full payment card numbers.
```

`primary_goal` is deliberately singled out because changes to it are high-impact behavioural changes.

## `constraints`

Defines safety, privacy, compliance, escalation and data access boundaries.

```yaml
constraints:
  safety:
    - Escalate threats of harm to human_support.
  privacy:
    - Never expose passwords, secrets or full payment card numbers.
  compliance:
    - Follow the published refund policy.
  escalation:
    - Fallback to human_support when policy coverage is unclear.
  data_access:
    - Only read approved account fields.
```

## `tools`

Defines tool contracts and risk metadata.

```yaml
tools:
  - name: account_lookup
    description: Reads account status from local fixtures.
    allowed_operations:
      - read_account_status
    forbidden_operations:
      - read_full_payment_card
    requires_auth: true
    risk_level: medium
```

Supported `risk_level` values:

- `low`
- `medium`
- `high`
- `critical`

## `routes`

Defines deterministic route candidates used by the local test runner and reviewers.

```yaml
routes:
  - name: billing_support
    description: Handles invoice and refund questions.
    triggers:
      - invoice
      - refund
    target: tool:account_lookup
    priority: 10
```

Targets currently use these conventions:

- `tool:<tool_name>`
- `handoff:<handoff_name>`

## `handoffs`

Defines human or workflow escalation destinations.

```yaml
handoffs:
  - name: human_support
    condition: Refund approval or unclear ownership requires human review.
    destination: queue:human-support
    required_context:
      - account_id
      - request_summary
```

## `tests`

Defines deterministic local checks over route, handoff and tool-call expectations.

```yaml
tests:
  - name: billing refund route
    input: Can I get a refund for my latest invoice?
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - route is billing_support
      - handoff is human_support
      - calls tool account_lookup
```

Tests do not call a model. They exercise the AgentSpec structure locally.
