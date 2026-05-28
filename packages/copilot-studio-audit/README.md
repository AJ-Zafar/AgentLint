# @agentspec/copilot-studio-audit

Experimental local audit tooling for comparing an AgentSpec file with a Microsoft Power Platform solution export that contains a Copilot Studio agent.

## Status

This package is experimental because Copilot Studio and Power Platform solution internals may change. The extractor uses best-effort local file inspection and should be treated as an aid for review, not as a complete or authoritative parser for Microsoft solution exports.

## What it does

- Reads a local `.zip` solution export.
- Inspects files where possible.
- Identifies likely bot topics, actions, Power Automate flows, knowledge references and handoff patterns.
- Compares extracted components with an AgentSpec document.
- Produces human-readable and JSON audit reports.

## What it does not do

- Does not call Microsoft APIs.
- Does not require Dataverse access.
- Does not authenticate to Power Platform.
- Does not validate official Copilot Studio package schemas.

## CLI

```bash
pnpm agentspec copilot-audit \
  --spec examples/copilot-studio-agent.agentspec.yaml \
  --solution packages/copilot-studio-audit/fixtures/fake-solution.zip

pnpm agentspec copilot-audit \
  --spec examples/copilot-studio-agent.agentspec.yaml \
  --solution packages/copilot-studio-audit/fixtures/fake-solution.zip \
  --json
```

## Extract and drift

```bash
pnpm agentlint copilot-extract ./solution.zip
pnpm agentlint copilot-drift --spec ./agent.agentspec.yaml --solution ./solution.zip
```

`copilot-extract` emits generated Agent Lint YAML. `copilot-drift` emits a drift report comparing a spec to extracted solution structure.

## Copilot drift scoring

`agentlint copilot-drift` calculates route drift, tool drift, handoff drift, governance drift and overall behavioural drift. Reports classify drift as `aligned`, `minor drift`, `significant drift` or `critical drift`, and include actionable remediation suggestions for missing topics, unexpected topics, missing actions, undocumented high-risk actions and fallback or handoff gaps.
