---
title: Diff and regression analysis
---

# Diff and regression analysis

AgentSpec diffs focus on behavioural impact rather than raw YAML structure.

A conventional line diff can show that text changed, but it does not explain whether the change affects tool risk, route triggers, fallback behaviour or escalation conditions. AgentSpec diff reports those concepts directly.

## Command

```bash
pnpm agentspec diff old.agentspec.yaml new.agentspec.yaml
```

JSON output is available for CI and review tooling:

```bash
pnpm agentspec diff old.agentspec.yaml new.agentspec.yaml --json
```

## Detected changes

The diff engine currently detects:

- changed primary goal
- changed `do` instructions
- changed `do_not` instructions
- added tools
- removed tools
- increased tool risk
- changed route triggers
- removed fallback behaviour
- changed escalation conditions
- changed handoff destinations
- changed tests

## Impact levels

Changes are classified as:

- `low impact`: useful review context, usually not behaviour-breaking alone
- `medium impact`: can alter behaviour or implementation work
- `high impact`: likely to alter behaviour materially
- `breaking`: can remove a dependency, fallback or behavioural contract

## Review use cases

Behavioural diffs are useful in pull requests and release reviews. They help reviewers focus on the parts of a spec that affect runtime behaviour or governance assumptions.

The diff result is not a risk assessment by itself. Treat it as a structured prompt for review.
