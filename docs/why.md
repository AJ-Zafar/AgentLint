---
title: Why AgentSpec exists
---

# Why AgentSpec exists

AI agent instructions are often written as long prose documents, prompt templates or scattered configuration fields. That resembles websites before modern IDEs and browsers made HTML, CSS and JavaScript easier to inspect, lint, test and change safely.

In many projects, agent instructions still have:

- no agreed syntax
- no schema validation
- no linting for ambiguous or conflicting guidance
- no local test scenarios
- no behavioural regression checks when instructions change
- limited editor support
- weak separation between instructions, tools, routes, handoffs and tests

This makes review difficult. A small wording change can alter routing, tool use or escalation behaviour without leaving a clear trace. Tool permissions may be described in one place and contradicted in another. Tests, where they exist, are often manual conversations with a model rather than repeatable checks over the instruction design.

AgentSpec exists to make agent instructions more inspectable and maintainable. It treats instructions as engineering artefacts: structured, versionable, reviewable and testable.

## The engineering gap

Most teams already expect code to have syntax, type checks, linting, unit tests and pull request review. Agent instructions increasingly control workflows, tools and user-facing decisions, but are often managed with less discipline than code.

AgentSpec brings familiar engineering practices to instruction design:

- schema validation for structure
- linting for common design defects
- deterministic tests for expected routing and tool-call behaviour
- behavioural diffs for reviewing changes
- editor diagnostics for faster feedback

## Assurance, not control

AgentSpec does not make AI behaviour deterministic. It cannot prove that an LLM will always respond in a particular way. It can, however, improve the quality of the artefacts used to configure an agent and catch avoidable issues earlier in the development process.

That distinction matters. AgentSpec is not a substitute for runtime monitoring, red-team testing, human review, access controls or platform governance. It is a practical layer of assurance before deployment.
