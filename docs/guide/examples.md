---
title: Examples gallery
---

# Examples gallery

The `examples/` directory contains realistic AgentSpec files for common agent patterns. Each gallery entry has a passing example and a separate intentional bad example.

Good examples are named:

```text
examples/<name>.agentspec.yaml
```

Bad examples are named:

```text
examples/<name>.bad.agentspec.yaml
```

Bad examples are schema-valid but intentionally fail one or more linter rules. They are useful for demos, documentation and testing governance gates. Normal example scripts and the CI workflow example exclude them by default.

## Gallery

| Scenario | Good example | Bad example | Focus |
| --- | --- | --- | --- |
| Customer support agent | `examples/customer-support.agentspec.yaml` | `examples/customer-support.bad.agentspec.yaml` | Billing, refunds, subscriptions and payment escalation. |
| HR policy assistant | `examples/hr-policy-assistant.agentspec.yaml` | `examples/hr-policy-assistant.bad.agentspec.yaml` | Leave, benefits and HR policy questions with privacy and employee relations handoff. |
| Public sector casework triage agent | `examples/public-sector-casework.agentspec.yaml` | `examples/public-sector-casework.bad.agentspec.yaml` | Safeguarding, welfare and statutory decision boundaries. |
| IT service desk agent | `examples/it-service-desk.agentspec.yaml` | `examples/it-service-desk.bad.agentspec.yaml` | IT incidents, access issues and security operations escalation. |
| Event RSVP assistant | `examples/event-rsvp-assistant.agentspec.yaml` | `examples/event-rsvp-assistant.bad.agentspec.yaml` | Attendance, dietary requests, accessibility and event co-ordinator review. |
| Power Platform governance assistant | `examples/power-platform-governance.agentspec.yaml` | `examples/power-platform-governance.bad.agentspec.yaml` | Connector, DLP, environment and production readiness governance. |
| Sales qualification agent | `examples/sales-qualification.agentspec.yaml` | `examples/sales-qualification.bad.agentspec.yaml` | Inbound qualification, CRM enrichment and account executive handoff. |

## Running the good examples

```bash
pnpm build
pnpm validate:examples
pnpm lint:examples
pnpm test:examples
```

The helper scripts run over root-level good examples and skip files ending in `.bad.agentspec.yaml`.

## Demonstrating lint failures

Run a bad example directly to see linter output:

```bash
pnpm agentspec lint examples/customer-support.bad.agentspec.yaml
```

The bad examples currently demonstrate missing primary goals. They can be expanded over time to demonstrate other lint rules.

## Using examples in reviews

The gallery is intended to help teams compare patterns across domains. When adding a new example, include:

- realistic instructions
- at least one tool with allowed and forbidden operations
- routes that target tools and a fallback route that targets a handoff
- handoff conditions and required context
- deterministic tests
- one separate bad example that validates but fails lint
