# @agentspec/copilot-studio

Experimental mapper from AgentSpec to Microsoft Copilot Studio implementation planning concepts.

## What it does

`convertAgentSpecToCopilotStudioPlan(spec)` returns a markdown implementation plan that identifies:

- Copilot Studio topics from AgentSpec routes
- Candidate actions from AgentSpec tools
- Knowledge sources from compliance, data access, and tool descriptions
- Handoff rules from AgentSpec handoffs
- Authentication assumptions from tool auth/risk metadata
- Candidate Power Automate flows from allowed tool operations

## Boundaries

- Does not call Microsoft APIs.
- Does not generate Copilot Studio export packages.
- Produces planning markdown only for human review.

## CLI

```bash
pnpm agentspec copilot-plan examples/copilot-studio-agent.agentspec.yaml
```
