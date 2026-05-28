---
title: Copilot Studio mapping
---

# Copilot Studio mapping

AgentSpec includes an experimental mapper for Microsoft Copilot Studio planning.

```bash
pnpm agentspec copilot-plan examples/copilot-studio-agent.agentspec.yaml
```

The command prints a markdown implementation plan. It does not call Microsoft APIs and does not generate a Copilot Studio export package.

## What is mapped

The mapper identifies:

- topics from AgentSpec routes
- candidate actions from AgentSpec tools
- knowledge sources from compliance, data access and tool descriptions
- handoff rules from AgentSpec handoffs
- authentication assumptions from tool metadata
- candidate Power Automate flows from allowed operations

## Intended use

The output is intended for planning and review. It can help architects and makers discuss how an AgentSpec might be implemented in Copilot Studio before anyone creates topics, actions, flows or connectors.

## Boundaries

This integration is deliberately conservative:

- no Microsoft APIs are called
- no tenant configuration is read
- no connector is created
- no Power Automate flow is created
- no Copilot Studio export package is generated

The generated plan should be reviewed by someone who understands the target environment, data policies and operational constraints.

## Auditing solution exports

AgentSpec also includes an experimental local audit package for comparing an AgentSpec file with a Power Platform solution export containing a Copilot Studio agent.

```bash
pnpm agentspec copilot-audit \
  --spec examples/copilot-studio-agent.agentspec.yaml \
  --solution packages/copilot-studio-audit/fixtures/fake-solution.zip
```

Use `--json` for CI-friendly output.

The audit command reads the local zip file, looks for likely bot topics, actions, flows, knowledge references and handoff patterns, then reports gaps against the AgentSpec. It does not call Microsoft APIs, does not require Dataverse access and does not generate or modify solution packages.

Because Copilot Studio solution internals may change, this should be treated as best-effort review support rather than an authoritative Microsoft package validator.

## Extract and drift commands

Expanded local solution support includes:

```bash
pnpm agentlint copilot-extract ./solution.zip
pnpm agentlint copilot-drift --spec ./agent.agentspec.yaml --solution ./solution.zip
pnpm agentlint copilot-drift --spec ./agent.agentspec.yaml --solution ./solution.zip --json
```

`copilot-extract` reads the local zip and emits a generated Agent Lint YAML spec based on extracted topics, trigger phrases, actions, flows, knowledge references, handoff configuration, authentication assumptions and fallback structures.

`copilot-drift` compares an existing Agent Lint spec with the extracted solution structure and reports missing topics, unexpected topics, missing actions, undocumented high-risk actions and fallback or handoff gaps.

These commands remain experimental and local-first. They do not call Microsoft APIs, do not require Dataverse access and do not validate official Copilot Studio export schemas.

## Copilot drift scoring

`agentlint copilot-drift` calculates route drift, tool drift, handoff drift, governance drift and overall behavioural drift. Reports classify drift as `aligned`, `minor drift`, `significant drift` or `critical drift`, and include actionable remediation suggestions for missing topics, unexpected topics, missing actions, undocumented high-risk actions and fallback or handoff gaps.
