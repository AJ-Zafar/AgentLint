---
title: Behaviour graph generation
---

# Behaviour graph generation

Agent Lint can compile an `.agentspec.yaml` file into an internal directed behaviour graph.

```bash
pnpm agentlint graph examples/customer-support.agentspec.yaml
pnpm agentlint graph examples/customer-support.agentspec.yaml --json
pnpm agentlint graph examples/customer-support.agentspec.yaml --mermaid
pnpm agentlint graph examples/customer-support.agentspec.yaml --ascii
```

## Graph model

The graph model uses these node types:

- `route`
- `decision`
- `tool`
- `constraint`
- `handoff`
- `fallback`
- `terminal_response`

Edges are typed as:

- `conditional_transition`
- `precedence_branch`
- `escalation_path`
- `tool_invocation_path`
- `constraint_gate`
- `terminal_transition`

## Mermaid example

```mermaid
flowchart LR
  decision_billing_support["billing_support decision
(decision)"]
  route_billing_support["billing_support
(route)"]
  tool_account_lookup["account_lookup
(tool)"]
  terminal_billing_support["billing_support response
(terminal_response)"]
  route_fallback_human_support["fallback_human_support
(fallback)"]
  handoff_human_support["human_support
(handoff)"]
  terminal_fallback_human_support["fallback_human_support response
(terminal_response)"]

  decision_billing_support -->|invoice OR refund OR subscription OR payment| route_billing_support
  route_billing_support -->|invoke| tool_account_lookup
  tool_account_lookup -->|respond| terminal_billing_support
  route_fallback_human_support -->|handoff| handoff_human_support
  handoff_human_support -->|respond| terminal_fallback_human_support
```

## Diagnostics

Graph compilation reports diagnostics for:

- invalid condition operators
- circular dependencies
- unreachable branches
- conflicting precedence definitions
- dead-end states
- unreachable nodes
- isolated routes

The graph command exits non-zero when an error-level diagnostic is found. Warning diagnostics are included in output but do not fail the command.
