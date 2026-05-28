# Security Policy

AgentSpec is experimental local-first tooling for AI instruction engineering. It does not currently call live LLM APIs, Microsoft APIs or other external services from its core commands.

## Supported versions

The project is pre-1.0. Security fixes will generally target the `main` branch until formal release channels exist.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities publicly before maintainers have had a reasonable opportunity to investigate.

If a private security contact is not yet published, open a GitHub issue requesting a maintainer security contact without including exploit details. A maintainer will arrange a private channel.

Helpful reports include:

- affected package or command
- reproduction steps
- expected and actual behaviour
- potential impact
- suggested mitigation, if known

## Security scope

In scope:

- unsafe file handling in local tooling
- dependency or build-chain issues
- CLI behaviour that could mislead CI/CD consumers
- VS Code extension issues related to local diagnostics

Out of scope:

- claims that AgentSpec can guarantee deterministic AI behaviour
- model jailbreaks unrelated to AgentSpec tooling
- issues in third-party agent platforms not caused by this project

## Responsible use

AgentSpec provides engineering assurance for agent instructions. It should be used alongside runtime monitoring, access controls, human review and platform-specific security governance.
