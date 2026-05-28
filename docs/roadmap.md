---
title: Roadmap
---

# Roadmap

## Status

AgentSpec is experimental. The roadmap is intended to make the project more useful for real-world instruction engineering while keeping the core tooling local-first and deterministic.

AgentSpec is early-stage infrastructure. The roadmap is intentionally practical and focused on improving local assurance before adding platform-specific integrations.

## Near term

- richer schema descriptions and published JSON schema artefacts
- better YAML source mapping for diagnostics
- more lint rules for safety, privacy, tool scope and escalation design
- configurable lint rule severity
- stronger deterministic assertions for the test runner
- CI-friendly reports for lint, test and diff commands
- VS Code quick fixes for common lint issues
- more realistic fixtures across domains

## Medium term

- policy packs for regulated or high-risk domains
- organisation-specific rule configuration
- compatibility reports for agent platforms
- richer behavioural diff summaries for pull requests
- import and planning adapters for additional agent platforms
- documentation for governance workflows

## Longer-term possibilities

- hosted collaboration and review workflows
- private registries for AgentSpec templates and policy packs
- dashboards for spec coverage and regression history
- enterprise integrations for approvals, evidence and audit trails

## What will stay local-first

The core specification, parser, linter, deterministic test runner, behavioural diff engine and CLI should remain useful without a hosted service. Commercial features, if developed, should build around collaboration, governance and managed integrations rather than making the local engineering substrate unusable.
