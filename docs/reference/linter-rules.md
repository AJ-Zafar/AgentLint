---
title: Linter rules
---

# Linter rules

This page is generated from linter rule metadata. Do not edit it by hand; run `pnpm docs:linter-rules` after changing rule metadata.

The AgentSpec linter is rule-based. Each rule is independent and returns a normalised diagnostic:

- `ruleId`
- `severity`: `error`, `warning` or `info`
- `message`
- `path`
- `suggestion`
- `confidence`

## Current rules

| Rule | Severity | Description |
| --- | --- | --- |
| `conflicting-do-and-do-not` | error | Detects instructions that appear in both do and do_not lists. |
| `duplicate-route-trigger` | warning | Detects route triggers reused across multiple routes. |
| `forbidden-operation-not-enforced` | warning | Checks forbidden tool operations are reflected in instructions or constraints. |
| `handoff-without-condition` | error | Requires each handoff to describe the condition that triggers it. |
| `high-risk-tool-without-auth` | error | Flags high or critical risk tools that do not require authentication. |
| `missing-fallback-route` | warning | Looks for an explicit fallback route that targets a handoff. |
| `missing-primary-goal` | error | Requires instructions.primary_goal to contain a clear objective. |
| `no-escalation-path` | error | Requires a complete escalation path with constraints, handoffs and a route to a handoff. |
| `route-target-not-defined` | error | Checks that every route target references an existing tool or handoff. |
| `test-without-assertions` | warning | Requires each test scenario to include at least one assertion. |
| `tool-without-risk-level` | warning | Requires tools to declare risk_level metadata. |
| `vague-instruction-language` | warning | Flags subjective instruction language such as be careful or use best judgement. |

## conflicting-do-and-do-not

- **Severity:** error
- **Description:** Detects instructions that appear in both do and do_not lists.

### Why it matters

Conflicting instructions make implementation and review ambiguous and can lead to unpredictable runtime behaviour.

### Bad example

```yaml
do:
  - Approve refunds
do_not:
  - Do not approve refunds
```

### Good example

```yaml
do:
  - Explain the refund policy
do_not:
  - Do not approve refunds without authorisation
```

### Suggested fix

Remove the duplicate meaning from one list, or rewrite the instructions so the boundary is explicit.

## duplicate-route-trigger

- **Severity:** warning
- **Description:** Detects route triggers reused across multiple routes.

### Why it matters

Duplicate triggers can make deterministic route selection ambiguous and hide routing regressions.

### Bad example

```yaml
routes:
  - name: billing
    triggers: [refund]
  - name: disputes
    triggers: [refund]
```

### Good example

```yaml
routes:
  - name: billing
    triggers: [invoice]
  - name: disputes
    triggers: [chargeback]
```

### Suggested fix

Make triggers distinct or consolidate overlapping routes.

## forbidden-operation-not-enforced

- **Severity:** warning
- **Description:** Checks forbidden tool operations are reflected in instructions or constraints.

### Why it matters

A forbidden operation listed only on a tool can be missed by reviewers reading behavioural instructions.

### Bad example

```yaml
forbidden_operations:
  - read_full_payment_card
```

### Good example

```yaml
do_not:
  - Do not read full payment card data
forbidden_operations:
  - read_full_payment_card
```

### Suggested fix

Add a matching do_not instruction or safety, privacy or data_access constraint.

## handoff-without-condition

- **Severity:** error
- **Description:** Requires each handoff to describe the condition that triggers it.

### Why it matters

A handoff without a condition cannot be reviewed as a clear escalation rule.

### Bad example

```yaml
handoffs:
  - name: human_support
    condition: ""
```

### Good example

```yaml
handoffs:
  - name: human_support
    condition: Account ownership is unclear or policy approval is required.
```

### Suggested fix

Add a specific condition that explains when the handoff should be used.

## high-risk-tool-without-auth

- **Severity:** error
- **Description:** Flags high or critical risk tools that do not require authentication.

### Why it matters

High-risk actions without authentication assumptions can create serious security and governance gaps.

### Bad example

```yaml
tools:
  - name: refund_approval
    risk_level: high
    requires_auth: false
```

### Good example

```yaml
tools:
  - name: refund_approval
    risk_level: high
    requires_auth: true
```

### Suggested fix

Set requires_auth to true, or lower the risk level only if the tool is genuinely low impact.

## missing-fallback-route

- **Severity:** warning
- **Description:** Looks for an explicit fallback route that targets a handoff.

### Why it matters

Agents need a predictable path for unclear, unmatched or policy-gap situations.

### Bad example

```yaml
routes:
  - name: billing_support
    target: tool:account_lookup
```

### Good example

```yaml
routes:
  - name: fallback_human_support
    triggers: [fallback, unclear]
    target: handoff:human_support
```

### Suggested fix

Add a low-priority fallback route with triggers such as fallback or unclear and target a handoff.

## missing-primary-goal

- **Severity:** error
- **Description:** Requires instructions.primary_goal to contain a clear objective.

### Why it matters

Without a primary goal, reviewers and test authors cannot tell what behaviour the agent is optimised for.

### Bad example

```yaml
instructions:
  primary_goal: ""
```

### Good example

```yaml
instructions:
  primary_goal: Route billing questions to approved support paths.
```

### Suggested fix

Add one concise, testable primary goal that describes the agent's main responsibility.

## no-escalation-path

- **Severity:** error
- **Description:** Requires a complete escalation path with constraints, handoffs and a route to a handoff.

### Why it matters

Without an escalation path, unclear or risky cases may have no safe deterministic route.

### Bad example

```yaml
constraints:
  escalation: []
handoffs: []
```

### Good example

```yaml
constraints:
  escalation:
    - Fallback to human_support when unclear.
routes:
  - target: handoff:human_support
```

### Suggested fix

Define escalation constraints, at least one handoff and a route that targets handoff:&lt;name&gt;.

## route-target-not-defined

- **Severity:** error
- **Description:** Checks that every route target references an existing tool or handoff.

### Why it matters

Undefined route targets break routing plans and make deterministic tests misleading.

### Bad example

```yaml
routes:
  - name: billing
    target: tool:missing_tool
```

### Good example

```yaml
tools:
  - name: account_lookup
routes:
  - name: billing
    target: tool:account_lookup
```

### Suggested fix

Define the referenced tool or handoff, or update the route target to an existing name.

## test-without-assertions

- **Severity:** warning
- **Description:** Requires each test scenario to include at least one assertion.

### Why it matters

Tests without assertions document inputs but do not define expected behaviour.

### Bad example

```yaml
tests:
  - name: refund route
    assertions: []
```

### Good example

```yaml
tests:
  - name: refund route
    assertions:
      - route is billing_support
```

### Suggested fix

Add assertions that describe expected route, handoff or tool-call behaviour.

## tool-without-risk-level

- **Severity:** warning
- **Description:** Requires tools to declare risk_level metadata.

### Why it matters

Risk metadata helps reviewers decide which tools need stronger controls and approval.

### Bad example

```yaml
tools:
  - name: account_lookup
    requires_auth: true
```

### Good example

```yaml
tools:
  - name: account_lookup
    requires_auth: true
    risk_level: medium
```

### Suggested fix

Set risk_level to low, medium, high or critical.

## vague-instruction-language

- **Severity:** warning
- **Description:** Flags subjective instruction language such as be careful or use best judgement.

### Why it matters

Vague instructions are hard to test, review and enforce consistently.

### Bad example

```yaml
secondary_goals:
  - Use best judgement and be helpful.
```

### Good example

```yaml
secondary_goals:
  - Escalate requests when account ownership is unclear.
```

### Suggested fix

Replace subjective language with observable, testable behaviour.

## Design principles

Rules should be deterministic, explainable and conservative. The linter should identify likely engineering issues without pretending to prove that an AI system is safe.

When adding rules, prefer:

- clear rule identifiers
- stable paths into the YAML structure
- actionable suggestions
- tests for positive and negative cases
