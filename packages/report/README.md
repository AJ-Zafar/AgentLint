# @agentspec/report

Governance evidence report generation for Agent Lint specs.

The report is designed for architecture review boards and enterprise governance sign-off. It composes existing Agent Lint engines rather than duplicating logic.

## Sections

- Agent summary
- Lint findings
- Behavioural coverage
- Scenario replay results
- Risk analysis
- Escalation assurance
- Tool access controls
- Policy compliance checks

## CLI

```bash
pnpm agentlint report ./agent.agentspec.yaml --format markdown
```
