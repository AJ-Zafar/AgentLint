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
