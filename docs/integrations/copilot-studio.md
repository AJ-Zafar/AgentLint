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
