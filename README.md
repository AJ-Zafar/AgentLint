# AgentSpec

AgentSpec is an open-source specification, linter and test framework for AI agent instructions.

It provides a structured YAML format for describing agent behaviour, plus local tooling for validation, linting, deterministic test scenarios, behavioural diffs, editor diagnostics and implementation planning.

AgentSpec is not a chatbot and it does not call live LLMs. It is infrastructure for AI instruction engineering.

## Why AgentSpec exists

AI agent instructions are often written as long prose documents, prompt templates or scattered configuration fields. That is roughly where websites were before modern IDEs and browsers made HTML, CSS and JavaScript easier to inspect, lint, test and change safely.

Today, many teams still manage agent instructions with:

- no agreed syntax
- no schema validation
- no linting for ambiguous or conflicting guidance
- no local test scenarios
- no behavioural regression checks when instructions change
- limited editor support
- little separation between instructions, tools, routes, handoffs and tests

AgentSpec exists to make agent instructions more inspectable and maintainable. It treats instructions as engineering artefacts: structured, versionable, reviewable and testable.

## What AgentSpec does

AgentSpec currently includes:

- a YAML-based AgentSpec format
- TypeScript types, Zod validation and generated JSON schema
- a parser for `.agentspec.yaml` and `.agentspec.yml` files
- a rule-based linter for common instruction design issues
- a deterministic local test runner for route, handoff, tool-call and assertion checks
- behavioural diffs between two AgentSpec files
- a VS Code extension package for inline diagnostics and commands
- an experimental Copilot Studio planning mapper

Everything is local-first. No Microsoft APIs, model APIs or external services are called by the core tooling.

## Documentation site

This repository includes a VitePress documentation site under `docs/`. Run it locally with:

```bash
pnpm docs:dev
```

Build the static site with:

```bash
pnpm docs:build
```

## Installation and quick start

This repository uses pnpm workspaces.

```bash
pnpm install
pnpm build
pnpm test
```

Validate, lint and test an example spec:

```bash
pnpm agentspec validate examples/customer-support.agentspec.yaml
pnpm agentspec lint examples/customer-support.agentspec.yaml
pnpm agentspec test examples/customer-support.agentspec.yaml
```

Compare two specs for behavioural impact:

```bash
pnpm agentspec diff old.agentspec.yaml new.agentspec.yaml
pnpm agentspec diff old.agentspec.yaml new.agentspec.yaml --json
```

Generate an experimental Copilot Studio implementation plan:

```bash
pnpm agentspec copilot-plan examples/copilot-studio-agent.agentspec.yaml
```

## Example AgentSpec YAML

```yaml
agent:
  name: Customer Support Triage Agent
  description: Routes customer support requests to approved workflows.
  version: 1.0.0
  owner: support-operations
  domain: customer-support

persona:
  role: Policy-grounded support triage assistant
  tone: calm and professional
  verbosity: concise
  style_rules:
    - Use plain language.
    - Explain when a human review is required.

instructions:
  primary_goal: Classify customer requests and choose the safest approved route.
  secondary_goals:
    - Collect only the account context required for the route.
    - Escalate refund exceptions and account ownership uncertainty.
  do:
    - Use declared routes before answering.
    - Use only approved tool operations for account context.
  do_not:
    - Do not request full payment card numbers, passwords or secrets.
    - Do not invent refund decisions.

constraints:
  safety:
    - Escalate threats of harm to human_support.
  privacy:
    - Never expose passwords, secrets or full payment card numbers.
  compliance:
    - Follow the published refund and cancellation policies.
  escalation:
    - Fallback to human_support when policy coverage or identity is unclear.
  data_access:
    - Only read account status, invoice summaries and subscription metadata.

tools:
  - name: account_lookup
    description: Reads customer account status from local fixtures.
    allowed_operations:
      - read_account_status
      - read_invoice_summary
    forbidden_operations:
      - read_full_payment_card
      - write_refund_decision
    requires_auth: true
    risk_level: medium

routes:
  - name: billing_support
    description: Handles invoices, refunds, subscriptions and failed payments.
    triggers:
      - invoice
      - refund
      - subscription
      - payment
    target: tool:account_lookup
    priority: 10
  - name: fallback_human_support
    description: Fallback route for unclear policy coverage or account ownership.
    triggers:
      - fallback
      - unclear
      - policy gap
    target: handoff:human_support
    priority: 100

handoffs:
  - name: human_support
    condition: Refund approval, account ownership uncertainty or policy exception.
    destination: queue:human-support
    required_context:
      - account_id
      - request_summary
      - attempted_route

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

## CLI commands

All CLI commands support `--json` for stable, machine-readable output suitable for CI/CD pipelines. Human-readable output remains the default.


### Validate

```bash
pnpm agentspec validate ./file.agentspec.yaml
pnpm agentspec validate ./file.agentspec.yaml --json
```

Checks that the YAML can be parsed and conforms to the AgentSpec schema. Use `--json` for stable CI output.

### Lint

```bash
pnpm agentspec lint ./file.agentspec.yaml
pnpm agentspec lint ./file.agentspec.yaml --json
```

Runs rule-based checks for issues such as missing goals, conflicting instructions, undefined route targets, missing fallback routes, high-risk tools without authentication and vague instruction language.

### Test

```bash
pnpm agentspec test ./file.agentspec.yaml
pnpm agentspec test ./file.agentspec.yaml --json
```

Runs deterministic local test scenarios. The runner matches inputs against route triggers, infers the likely route, handoff and tool calls, checks expected and forbidden tool calls, evaluates simple assertions and prints a summary score.

### Diff

```bash
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml --json
```

Reports behavioural impact rather than raw line changes. It detects changes to goals, `do`/`do_not` instructions, tools, tool risk, route triggers, fallback behaviour, escalation conditions, handoff destinations and tests. Changes are classified as low, medium, high or breaking impact.

### Copilot Studio plan

```bash
pnpm agentspec copilot-plan ./file.agentspec.yaml
pnpm agentspec copilot-plan ./file.agentspec.yaml --json
```

Produces experimental markdown that maps AgentSpec concepts to Microsoft Copilot Studio planning concepts: topics, actions, knowledge sources, handoff rules, authentication assumptions and candidate Power Automate flows. It does not call Microsoft APIs and does not generate Copilot Studio export packages.

## Linting examples

AgentSpec lint rules return a rule id, severity, message, path, suggestion and confidence score.

Example issue:

```text
Errors (1)
  - route-target-not-defined [routes.0.target]
    Route "billing_support" targets undefined tool "account_lookup".
    Suggestion: Define tool "account_lookup" or update the route target to an existing tool.
    Confidence: 99%
```

Current rule coverage includes:

- `missing-primary-goal`
- `conflicting-do-and-do-not`
- `route-target-not-defined`
- `handoff-without-condition`
- `missing-fallback-route`
- `tool-without-risk-level`
- `high-risk-tool-without-auth`
- `vague-instruction-language`
- `duplicate-route-trigger`
- `test-without-assertions`
- `forbidden-operation-not-enforced`
- `no-escalation-path`

## Testing examples

AgentSpec tests are deterministic checks over the specification, not model evaluations.

Supported assertions currently include:

- `route is <name>`
- `handoff is <name>`
- `calls tool <name>`
- `does not call tool <name>`
- `input contains <text>`

Example output:

```text
AgentSpec Test Results

Passed (1)
  - billing refund route
    route=billing_support, handoff=human_support, tools=account_lookup

Summary: 1/1 passed, 0 failed, score 100%
```

The test runner is deliberately simple. It is intended to catch obvious regressions in routing, handoff and tool-call expectations before a spec reaches a live agent runtime.

## VS Code support

The `packages/vscode-extension` package recognises `.agentspec.yaml` and `.agentspec.yml` files, shows validation and lint diagnostics inline, and contributes these commands:

- `AgentSpec: Validate Current File`
- `AgentSpec: Lint Current File`

The extension uses the existing parser and linter packages so editor behaviour stays aligned with the CLI.

## Repository layout

```text
packages/spec              TypeScript types, Zod schema and JSON schema generation
packages/parser            YAML parser and validation wrapper
packages/linter            Rule-based lint engine
packages/test-runner       Deterministic local test runner
packages/diff              Behavioural diff engine
packages/cli               Command-line interface
packages/vscode-extension  VS Code extension package
packages/copilot-studio    Experimental Copilot Studio planning mapper
examples/                  Example AgentSpec files
```

## Roadmap

Near-term areas of work:

- richer schema documentation and JSON schema publishing
- improved source mapping from schema/lint paths to YAML ranges
- more lint rules for safety, privacy, tool scope and escalation design
- stronger deterministic test assertions
- snapshot output for CI use
- VS Code quick fixes for common lint issues
- fixture-based behavioural regression suites
- import/export planning for specific agent platforms

Longer-term areas being considered:

- policy packs for regulated domains
- organisation-specific rule configuration
- richer simulation adapters
- compatibility reports for agent platforms
- hosted collaboration, review and governance workflows

## Open-core positioning

AgentSpec is intended to be commercial-friendly open-source infrastructure.

The core specification, parser, linter, deterministic test runner, behavioural diff engine and local CLI should remain useful without a paid service. A future commercial layer could reasonably focus on team workflows, hosted review, dashboards, managed policy packs, compliance evidence, private registries and integrations with enterprise systems.

The aim is to keep the engineering substrate open while leaving room for sustainable commercial development around collaboration and governance.

## Contributing

Contributions are welcome. Good first areas include:

- improving documentation and examples
- adding focused lint rules with tests
- expanding deterministic assertion support
- improving YAML diagnostic ranges
- adding realistic AgentSpec fixtures for different domains
- tightening TypeScript types and schema descriptions

Before opening a pull request, run:

```bash
pnpm install
pnpm test
pnpm build
```

Please keep changes small, deterministic and covered by tests where behaviour changes.

## Disclaimer

AgentSpec does not provide deterministic control over AI systems.

LLM-backed agents can still behave unexpectedly because model outputs depend on model behaviour, runtime context, retrieval, tool results and deployment configuration. AgentSpec is an engineering assurance tool: it helps teams structure instructions, find common problems, run local checks and review behavioural changes before deployment.

It should be used alongside runtime monitoring, human review, safety evaluation, access controls and platform-specific governance.
