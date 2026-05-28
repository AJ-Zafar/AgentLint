---
title: Quickstart
---

# Quickstart

This repository uses pnpm workspaces.

## Install

```bash
pnpm install
```

## Build and test the workspace

```bash
pnpm build
pnpm test
```

## Validate a spec

```bash
pnpm agentspec validate examples/customer-support.agentspec.yaml
```

This checks that the YAML parses and conforms to the AgentSpec schema.

## Lint a spec

```bash
pnpm agentspec lint examples/customer-support.agentspec.yaml
```

This runs the rule-based linter and reports issues grouped by severity.

## Run deterministic tests

```bash
pnpm agentspec test examples/customer-support.agentspec.yaml
```

The test runner does not call an LLM. It matches test inputs against route triggers, infers likely route and handoff behaviour, checks expected and forbidden tool calls, evaluates simple assertions and prints a summary score.

## Compare two specs

```bash
pnpm agentspec diff examples/customer-support.agentspec.yaml examples/copilot-studio-agent.agentspec.yaml
```

Use JSON output for automation:

```bash
pnpm agentspec diff old.agentspec.yaml new.agentspec.yaml --json
```

## Generate a Copilot Studio plan

```bash
pnpm agentspec copilot-plan examples/copilot-studio-agent.agentspec.yaml
```

This prints an experimental markdown implementation plan. It does not call Microsoft APIs and does not generate an export package.

## Start the docs site

```bash
pnpm docs:dev
```

Build the static docs site with:

```bash
pnpm docs:build
```
