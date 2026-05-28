# Agent Lint v0.1.0 release notes

Agent Lint v0.1.0 is the first experimental release of the project.

Agent Lint is an open-source framework and CLI for defining, validating, linting, testing, comparing and reviewing AI agent instruction specifications. The code in this repository currently uses `.agentspec.yaml` files and `@agentspec/*` package names, but the public project name is Agent Lint.

## Status

This is an early-stage release intended for experimentation, local assurance workflows, examples, documentation review and initial CI integration. APIs, YAML fields, package boundaries and rule behaviour may change before a stable 1.0 release.

## Highlights

- Agent Lint YAML specification with validation and JSON schema generation.
- CLI for validation, linting, testing, diffing, coverage, replay, graph generation, reporting and Copilot Studio analysis.
- Rule-based linter with policy packs, semantic ambiguity checks and deterministic autofix scaffolding.
- Deterministic test runner, behavioural diff simulation, coverage analysis and scenario replay.
- Behaviour graph compiler with JSON, ASCII and Mermaid output.
- Governance evidence report generation for architecture review.
- Experimental natural language compiler from loose instructions to Agent Lint YAML.
- Experimental Copilot Studio plan, extract, drift and audit commands.
- VS Code LSP extension package.
- VitePress documentation site.
- GitHub Actions workflows and CI governance examples.

## Package status

Core packages such as spec, parser, linter, test runner, diff and CLI are suitable for local experimentation. Several packages are explicitly marked experimental in package metadata, including grammar, compiler, replay, coverage, report, VS Code extension and Copilot Studio support.

## Verification for release readiness

The release preparation checks include:

```bash
pnpm install
pnpm test
pnpm build
pnpm docs:build
pnpm validate:examples
pnpm lint:examples
pnpm test:examples
```

## Important limitations

- No command calls live LLM APIs.
- Copilot Studio commands do not call Microsoft APIs and do not require Dataverse access.
- Agent Lint provides engineering assurance, not deterministic control over LLM-backed agents.
- Generated YAML and autofixes that include `TODO` or `agentlint_fixme` annotations require human review.
