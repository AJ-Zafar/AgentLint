# Changelog

All notable changes to Agent Lint will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow semantic versioning once the public API stabilises. The project is currently experimental.

## [0.1.0] - 2026-05-28

### Added

- Initial Agent Lint monorepo using TypeScript and pnpm workspaces.
- YAML-based Agent Lint specification model using the current `.agentspec.yaml` file format.
- Type definitions, Zod validation and JSON schema generation in `@agentspec/spec`.
- YAML parsing and validation wrapper in `@agentspec/parser`.
- Rule-based linter with metadata-backed rule documentation in `@agentspec/linter`.
- Built-in policy packs: `public-sector-safe`, `financial-services`, `healthcare` and `internal-enterprise`.
- Deterministic lint autofix support for safe scaffolding and explicit review annotations.
- Deterministic test runner for route, handoff, tool-call and assertion checks.
- Behavioural diff and simulated behavioural regression analysis.
- Formal grammar layer with structured conditions, precedence and behaviour graph compilation.
- Scenario replay with step-by-step traces and Mermaid visual output.
- Behavioural coverage analysis.
- Governance evidence report generation.
- Experimental deterministic natural language compiler from loose instructions to Agent Lint YAML.
- VS Code Language Server Protocol extension with diagnostics, completion, hover, quick fixes, definitions and commands.
- Experimental Copilot Studio planning, solution extraction, drift scoring and local audit support.
- VitePress documentation site.
- Examples gallery with good and intentionally lint-invalid examples.
- GitHub Actions workflows and reusable CI governance example.
- Open-source project files: MIT licence, code of conduct, contributing guide, security policy and templates.

### Notes

- This release is explicitly experimental.
- Agent Lint does not guarantee deterministic AI behaviour. It provides local engineering assurance for instruction artefacts.
- Copilot Studio support is local-first and does not call Microsoft APIs or require Dataverse access.
