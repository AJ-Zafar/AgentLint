---
title: Testing agent behaviour
---

# Testing agent behaviour

AgentSpec tests are deterministic checks over the specification. They do not call an LLM and they do not evaluate natural language generation quality.

The goal is to catch obvious regressions in route, handoff and tool-call expectations before a spec reaches a live agent runtime.

## How the runner works

For each test scenario, the runner:

1. tokenises the input
2. matches the input against route triggers
3. infers the most likely route
4. infers likely handoff behaviour from route targets and handoff conditions
5. infers tool calls from route targets
6. checks expected tool calls
7. checks forbidden tool calls
8. evaluates simple assertions
9. reports passed and failed tests with expected versus actual values

## Example test

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

## Supported assertions

Current assertions are intentionally simple:

- `route is <name>`
- `handoff is <name>`
- `calls tool <name>`
- `does not call tool <name>`
- `input contains <text>`

Unsupported assertions fail explicitly. This keeps tests deterministic and avoids implying model-level semantic evaluation.

## Example output

```text
AgentSpec Test Results

Passed (1)
  - billing refund route
    route=billing_support, handoff=human_support, tools=account_lookup

Summary: 1/1 passed, 0 failed, score 100%
```

## Limits

The runner does not prove that a deployed agent will behave correctly. It tests the AgentSpec routing and expectation model. Use it as a fast local regression check alongside model evaluation, monitoring and human review.

## Behavioural coverage

```bash
pnpm agentlint coverage ./agent.agentspec.yaml
pnpm agentlint coverage ./agent.agentspec.yaml --json
```

Reports route, handoff, tool, constraint, fallback and test scenario coverage. The report includes percentage coverage, uncovered branches and recommended test scenarios.
