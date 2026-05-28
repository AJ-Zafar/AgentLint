---
title: Linter rules
---

# Linter rules

The AgentSpec linter is rule-based. Each rule is independent and returns a normalised diagnostic:

- `ruleId`
- `severity`: `error`, `warning` or `info`
- `message`
- `path`
- `suggestion`
- `confidence`

## Current rules

| Rule | Purpose |
| --- | --- |
| `missing-primary-goal` | Ensures the spec has a clear primary goal. |
| `conflicting-do-and-do-not` | Detects instructions that appear in both `do` and `do_not`. |
| `route-target-not-defined` | Checks route targets reference existing tools or handoffs. |
| `handoff-without-condition` | Ensures handoffs describe when they apply. |
| `missing-fallback-route` | Looks for an explicit fallback route to a handoff. |
| `tool-without-risk-level` | Flags tools without risk metadata. |
| `high-risk-tool-without-auth` | Requires authentication for high or critical risk tools. |
| `vague-instruction-language` | Flags terms such as “be careful” or “use best judgement”. |
| `duplicate-route-trigger` | Detects overlapping route triggers. |
| `test-without-assertions` | Ensures tests include behavioural assertions. |
| `forbidden-operation-not-enforced` | Checks forbidden tool operations are reflected in instructions or constraints. |
| `no-escalation-path` | Ensures escalation constraints, handoffs and handoff routes exist. |

## Example output

```text
Errors (1)
  - route-target-not-defined [routes.0.target]
    Route "billing_support" targets undefined tool "account_lookup".
    Suggestion: Define tool "account_lookup" or update the route target to an existing tool.
    Confidence: 99%
```

## Design principles

Rules should be deterministic, explainable and conservative. The linter should identify likely engineering issues without pretending to prove that an AI system is safe.

When adding rules, prefer:

- clear rule identifiers
- stable paths into the YAML structure
- actionable suggestions
- tests for positive and negative cases
