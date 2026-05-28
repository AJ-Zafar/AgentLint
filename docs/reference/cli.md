---
title: CLI reference
---

# CLI reference

The CLI is exposed through the root package script during development:

```bash
pnpm agentspec <command>
```

Build the workspace before running commands against compiled output:

```bash
pnpm build
```

All commands support `--json` for stable, machine-readable output in CI/CD pipelines. Human-readable output remains the default.

## `validate`

```bash
pnpm agentspec validate ./file.agentspec.yaml
pnpm agentspec validate ./file.agentspec.yaml --json
```

Parses YAML and validates the document against the AgentSpec schema.

## `lint`

```bash
pnpm agentspec lint ./file.agentspec.yaml
pnpm agentspec lint ./file.agentspec.yaml --json
```

Runs the rule-based linter and prints grouped diagnostics. The process exits non-zero when lint issues are found.

Apply built-in policy packs with `--policy <pack>`:

```bash
pnpm agentlint lint ./file.agentspec.yaml --policy public-sector-safe
pnpm agentlint lint ./file.agentspec.yaml --policy financial-services --json
```

## `test`

```bash
pnpm agentspec test ./file.agentspec.yaml
pnpm agentspec test ./file.agentspec.yaml --json
```

Runs deterministic test scenarios from the `tests` section. The process exits non-zero when one or more tests fail.

## `diff`

```bash
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml
```

Reports behavioural impact between two specs.

Use JSON output for automation:

```bash
pnpm agentspec diff ./old.agentspec.yaml ./new.agentspec.yaml --json
```

## `copilot-plan`

```bash
pnpm agentspec copilot-plan ./file.agentspec.yaml
pnpm agentspec copilot-plan ./file.agentspec.yaml --json
```

Generates an experimental Microsoft Copilot Studio implementation plan in markdown. This is a planning aid only; it does not call Microsoft APIs or generate export packages.

## Exit behaviour

- `validate` exits non-zero for invalid YAML or schema errors.
- `lint` exits non-zero when lint issues are found.
- `test` exits non-zero when tests fail.
- `diff` currently reports changes but does not fail solely because changes exist.

## `graph`

```bash
pnpm agentlint graph ./file.agentspec.yaml
pnpm agentlint graph ./file.agentspec.yaml --json
```

Compiles a spec into an internal behaviour graph. The graph command validates structured condition expressions, route dependencies, precedence definitions and unreachable branches.

## `compile`

```bash
pnpm agentlint compile ./instructions.md
```

Experimentally compiles loose natural language instructions into structured Agent Lint YAML using deterministic heuristics. The output includes compiler confidence metadata and unresolved ambiguity warnings. No external LLM APIs are called.

## `simulate-diff`

```bash
pnpm agentlint simulate-diff ./old.agentspec.yaml ./new.agentspec.yaml
pnpm agentlint simulate-diff ./old.agentspec.yaml ./new.agentspec.yaml --json
```

Runs deterministic scenario generation over two specs and reports behavioural simulation changes, including route selection, escalation frequency, tool eligibility, fallback invocation, constraint precedence, impacted routes and likely regression areas.

## `replay`

```bash
pnpm agentlint replay ./agent.agentspec.yaml --scenario angry-refund-user
pnpm agentlint replay ./agent.agentspec.yaml --scenario angry-refund-user --json
```

Runs deterministic path evaluation through the behaviour graph for a named scenario and reports the decision path, triggered constraints, selected route, tool eligibility checks, handoff reasoning and execution trace.

## Autofix support

Agent Lint can apply deterministic scaffolding fixes:

```bash
pnpm agentlint lint ./file.agentspec.yaml --fix
pnpm agentlint lint ./file.agentspec.yaml --fix --json
```

Autofix can add missing fallback scaffolds, add default `risk_level: medium`, retarget undefined route targets to an existing handoff, add placeholder handoff conditions, annotate weak escalation wording and normalise YAML output.

Autofix deliberately does not rewrite semantic intent. When a fix needs human judgement, Agent Lint adds explicit `TODO` or `agentlint_fixme` annotations and reports manual review warnings.
