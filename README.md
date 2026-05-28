# Agent Lint

[![Status: Experimental](https://img.shields.io/badge/status-experimental-orange.svg)](#status-experimental) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![CI](https://github.com/AJ-Zafar/AgentLint/actions/workflows/ci.yml/badge.svg)](https://github.com/AJ-Zafar/AgentLint/actions/workflows/ci.yml) [![Docs](https://img.shields.io/badge/docs-VitePress-42b883.svg)](docs/)

Syntax, linting and regression checks for AI agent instructions.

## Opening story

Early websites were often edited as raw HTML in Notepad or similar text editors. There was little syntax help, little validation, no modern linting, no integrated test feedback and no reliable way to understand what a change might break. Modern IDEs such as VS Code changed that development experience by making web code easier to inspect, validate, refactor and review.

AI instruction engineering is in a similar place today. Agent instructions are often written as loose prose, prompt fragments or platform-specific configuration. They can be important enough to control tools, handoffs and user-facing workflows, but they frequently lack syntax, linting, validation, testing, diffing and regression checks.

Agent Lint exists to bring some of that missing engineering discipline to AI agent instructions.

Thanks to Chris Huntingford for highlighting the "HTML before VS Code" comparison that helped shape the framing for this project.

## What Agent Lint is

Agent Lint is an open-source framework and CLI for defining, validating, linting, testing and comparing AI agent instruction specifications.

The repository currently uses `.agentspec.yaml` files and `@agentspec/*` package names in code. Those names are implementation details of the current workspace and may evolve, but the project is positioned publicly as Agent Lint.

Agent Lint is local-first. The implemented validation, linting, testing, diffing and documentation commands do not call live LLM APIs. The Copilot Studio planning and audit features are also local and experimental.

## What problem it solves

Agent instructions can become hard to govern as soon as they include tools, routes, handoffs and policy constraints. Agent Lint is designed to catch and review issues such as:

- ambiguous agent instructions
- conflicting rules
- missing fallback behaviour
- undocumented tools and actions
- risky tool access
- broken handoff logic
- instruction changes with unknown behavioural impact

It does not guarantee deterministic AI behaviour. It provides an assurance layer for the instruction artefacts that teams review, test and deploy.

## Current capabilities

The current workspace includes:

- `@agentspec/spec`: TypeScript types, Zod validation and JSON schema generation
- `@agentspec/parser`: YAML parser and validation wrapper for `.agentspec.yaml` files
- `@agentspec/linter`: rule-based linter with documented rule metadata
- `@agentspec/test-runner`: deterministic local route, handoff, tool and assertion checks
- `@agentspec/diff`: behavioural diff engine for comparing instruction specs
- `@agentspec/cli`: CLI commands for validate, lint, test, diff, Copilot planning and Copilot audit
- `agentspec-vscode`: VS Code extension package for diagnostics and current-file commands
- `@agentspec/copilot-studio`: experimental markdown implementation plan mapper for Copilot Studio
- `@agentspec/copilot-studio-audit`: experimental local audit of Power Platform solution zip exports
- VitePress documentation site under `docs/`
- GitHub Actions workflows and example CI governance gate
- examples gallery with good and intentionally bad `.agentspec.yaml` files

## Quick start

Install dependencies:

```bash
pnpm install
```

Build and test the workspace:

```bash
pnpm build
pnpm test
```

Validate, lint and test an example instruction spec:

```bash
pnpm agentspec validate examples/customer-support.agentspec.yaml
pnpm agentspec lint examples/customer-support.agentspec.yaml
pnpm agentspec test examples/customer-support.agentspec.yaml
```

Compare two specs for behavioural impact:

```bash
pnpm agentspec diff examples/customer-support.agentspec.yaml examples/copilot-studio-agent.agentspec.yaml
pnpm agentspec diff examples/customer-support.agentspec.yaml examples/copilot-studio-agent.agentspec.yaml --json
```

Run the docs site locally:

```bash
pnpm docs:dev
```

## Example Agent Lint YAML

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

instructions:
  primary_goal: Classify customer requests and choose the safest approved route.
  secondary_goals:
    - Collect only the account context required for the route.
  do:
    - Use declared routes before answering.
  do_not:
    - Do not request full payment card numbers, passwords or secrets.
    - Do not write refund decisions.

constraints:
  safety:
    - Escalate threats of harm to human_support.
  privacy:
    - Never expose passwords, secrets or full payment card numbers.
  compliance:
    - Follow the published refund and cancellation policies.
  escalation:
    - Fallback to human_support when policy coverage or account ownership is unclear.
  data_access:
    - Only read account status and invoice summaries.

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

## CLI usage

The development CLI is available through the root package script:

```bash
pnpm agentspec <command>
```

Build first when running against compiled output:

```bash
pnpm build
```

### Validate

```bash
pnpm agentspec validate ./file.agentspec.yaml
pnpm agentspec validate ./file.agentspec.yaml --json
```

Parses YAML and validates it against the current schema.

### Lint

```bash
pnpm agentspec lint ./file.agentspec.yaml
pnpm agentspec lint ./file.agentspec.yaml --json
```

Runs the rule-based linter and exits non-zero when issues are found.

### Test

```bash
pnpm agentspec test ./file.agentspec.yaml
pnpm agentspec test ./file.agentspec.yaml --json
```

Runs deterministic local checks over route, handoff, expected tool calls, forbidden tool calls and simple assertions.

### Diff

```bash
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml --json
```

Reports behavioural impact rather than raw line changes. The implemented diff detects changed goals, changed `do` and `do_not` instructions, added or removed tools, increased tool risk, changed route triggers, removed fallback behaviour, changed escalation conditions, changed handoff destinations and changed tests.

### Copilot Studio plan

```bash
pnpm agentspec copilot-plan ./file.agentspec.yaml
pnpm agentspec copilot-plan ./file.agentspec.yaml --json
```

Generates an experimental markdown implementation plan that maps the spec to Copilot Studio planning concepts.

### Copilot Studio audit

```bash
pnpm agentspec copilot-audit --spec ./file.agentspec.yaml --solution ./solution.zip
pnpm agentspec copilot-audit --spec ./file.agentspec.yaml --solution ./solution.zip --json
```

Experimentally inspects a local Power Platform solution export zip and compares likely Copilot Studio components with the expected instruction spec.

## Copilot Studio angle

Agent Lint includes two experimental Copilot Studio related packages.

The planning mapper can turn an instruction spec into a markdown implementation plan covering likely topics, actions, knowledge sources, handoff rules, authentication assumptions and Power Automate flows.

The audit package can inspect a local Power Platform solution zip where possible, identify likely bot-related files and compare extracted topics, actions, flows, knowledge references and handoff patterns against the intended spec.

This can be used as an assurance layer around Copilot Studio agents. It helps compare intended behaviour against exported solution structure. It does not call Microsoft APIs, does not require Dataverse access and does not claim full Microsoft solution package compatibility.

## How teams get value

Agent Lint is intended to support practical engineering and governance workflows:

- pre-flight checks before publishing agent changes
- pull request checks for instruction changes
- governance evidence for enterprise teams
- regression testing for routes, tools and handoffs
- behavioural diff review when instructions change
- shared language between architects, makers and developers
- examples that show both good patterns and intentional lint failures

The GitHub Actions example in `examples/github-actions/agentspec-check.yml` shows how to validate, lint and test instruction specs in CI.

## Architecture

```mermaid
flowchart LR
  YAML[.agentspec.yaml files] --> Parser[@agentspec/parser]
  Parser --> Spec[@agentspec/spec]
  Parser --> Linter[@agentspec/linter]
  Parser --> Runner[@agentspec/test-runner]
  Parser --> Diff[@agentspec/diff]
  Parser --> Planner[@agentspec/copilot-studio]
  Parser --> Audit[@agentspec/copilot-studio-audit]
  Linter --> CLI[@agentspec/cli]
  Runner --> CLI
  Diff --> CLI
  Planner --> CLI
  Audit --> CLI
  Parser --> VSCode[agentspec-vscode]
  Linter --> VSCode
  CLI --> CI[GitHub Actions and CI gates]
  CLI --> Docs[VitePress docs and examples]
```

The core packages are local-first. The CLI and VS Code extension reuse parser, schema and linter packages rather than duplicating validation logic.

## Roadmap

Realistic near-term work includes:

- richer semantic linting
- stronger Copilot Studio extraction from solution exports
- better VS Code diagnostics and source ranges
- CI policy gates and report artefacts
- a more capable local simulation engine
- hosted reporting for teams that want dashboards and audit history
- integration adapters for additional agent platforms

The project should keep the core specification, parser, linter, deterministic test runner, behavioural diff engine and CLI useful without a hosted service.

## Status: experimental

Agent Lint is experimental and early-stage. The YAML format, linter rules, package boundaries and Copilot Studio extraction logic may change as the project is tested against more real-world agent instruction workflows.

Use it today as an engineering assurance tool for review, CI checks and regression detection. Do not treat it as a guarantee of deterministic AI behaviour.

## Contributing

Contributions are welcome. Good first areas include:

- documentation and examples
- additional linter rules with metadata and tests
- stronger deterministic assertions
- improved YAML diagnostic locations
- Copilot Studio audit fixtures
- CI reporting improvements

Before opening a pull request, run:

```bash
pnpm install
pnpm test
pnpm build
pnpm docs:build
```

If you change linter rule metadata, regenerate the rule docs:

```bash
pnpm docs:linter-rules
```

## Acknowledgement

Thanks to Chris Huntingford for highlighting the "HTML before VS Code" comparison that helped shape the framing for this project.

## Disclaimer

Agent Lint does not provide deterministic control over AI systems. LLM-backed agents can still behave unexpectedly because outputs depend on model behaviour, runtime context, retrieval, tools and deployment configuration.

Agent Lint is an assurance and engineering discipline tool. It helps teams structure instructions, find common problems, run local checks and review behavioural changes before deployment. It should be used alongside runtime monitoring, access controls, human review, safety evaluation and platform-specific governance.
