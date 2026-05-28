# AgentSpec

AgentSpec is a local-first TypeScript monorepo for writing, validating, linting, testing, and diffing structured AI agent instructions.

This project is infrastructure for instruction engineering, not a chatbot. All commands are deterministic and run without live LLM calls.

## Packages

- `@agentspec/spec` - TypeScript types, JSON schema, and Zod runtime validation.
- `@agentspec/parser` - Loads `.agentspec.yaml` files and returns typed documents.
- `@agentspec/linter` - Finds common instruction-engineering issues.
- `@agentspec/test-runner` - Runs deterministic local test scenarios without LLM calls.
- `@agentspec/cli` - Commander-based CLI exposing `validate`, `lint`, `test`, and `diff`.

## Commands

```bash
pnpm install
pnpm test
pnpm build

pnpm agentspec validate examples/customer-support.agentspec.yaml
pnpm agentspec lint examples/customer-support.agentspec.yaml
pnpm agentspec test examples/customer-support.agentspec.yaml
pnpm agentspec diff examples/customer-support.agentspec.yaml examples/copilot-studio-agent.agentspec.yaml
```

## Deterministic tests

`agentspec test` evaluates each YAML test scenario locally without model calls. The runner matches input text against route triggers, infers the likely route, handoff, and tool calls, checks expected and forbidden tool calls, evaluates simple assertions such as `route is <name>`, `handoff is <name>`, `calls tool <name>`, `does not call tool <name>`, and `input contains <text>`, then reports passed tests, failed tests, reasons, expected vs actual values, and a summary score.

## AgentSpec v1 YAML shape

AgentSpec files use YAML and this first format version is organized around explicit instruction-engineering sections:

```yaml
agent:
  name: Customer Support Triage Agent
  description: Routes customer questions to deterministic workflows.
  version: 1.0.0
  owner: support-operations
  domain: customer-support
persona:
  role: Policy-grounded support triage assistant
  tone: calm and professional
  verbosity: concise
  style_rules:
    - Use plain language.
instructions:
  primary_goal: Classify requests and choose the safest approved route.
  secondary_goals:
    - Collect only required context.
  do:
    - Use declared routes before answering.
  do_not:
    - Do not request secrets or full payment card numbers.
constraints:
  safety:
    - Escalate threats of harm to a human handoff.
  privacy:
    - Never expose protected personal data.
  compliance:
    - Follow published policy.
  escalation:
    - Fallback to a named handoff when policy coverage is unclear.
  data_access:
    - Only use fields returned by approved tools.
tools:
  - name: account_lookup
    description: Reads account status from local fixtures.
    allowed_operations:
      - read_account_status
    forbidden_operations:
      - read_full_payment_card
    requires_auth: true
    risk_level: medium
routes:
  - name: billing_support
    description: Handles invoice and refund questions.
    triggers:
      - invoice
      - refund
    target: tool:account_lookup
    priority: 10
handoffs:
  - name: human_support
    condition: Refund approval or unclear ownership requires human review.
    destination: queue:human-support
    required_context:
      - account_id
      - request_summary
tests:
  - name: billing refund route
    input: Can I get a refund for my latest invoice?
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - Does not ask for full payment card details.
```

`@agentspec/spec` exports TypeScript types, strict Zod validation, `generateAgentSpecJsonSchema()`, and a generated `agentSpecJsonSchema` constant for editor and CLI consumers.
