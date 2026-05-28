---
title: Introduction
---

# AgentSpec

AgentSpec is an open-source specification, linter and test framework for AI agent instructions.

It gives teams a structured YAML format for describing agent behaviour, plus local tooling for validation, linting, deterministic test scenarios, behavioural diffs and editor feedback. It is designed for instruction engineering: the work of making agent instructions easier to review, test, change and govern.

AgentSpec is not a chatbot runtime. It does not call live LLMs, model APIs or platform APIs. The core tools are local and deterministic.

## What is included

AgentSpec currently provides:

- a YAML specification for agents, personas, instructions, constraints, tools, routes, handoffs and tests
- TypeScript types, Zod validation and generated JSON schema
- a parser for `.agentspec.yaml` and `.agentspec.yml` files
- a rule-based linter for common instruction design issues
- a deterministic test runner for route, handoff, tool-call and assertion checks
- behavioural diffs for reviewing instruction changes
- a VS Code Language Server Protocol extension for inline diagnostics, completion, hover and commands
- an experimental Copilot Studio planning mapper

## Who it is for

AgentSpec is intended for:

- developers building AI agent features
- platform teams standardising agent development practices
- architects reviewing tool access, escalation and compliance boundaries
- QA and governance teams looking for repeatable pre-deployment checks
- open-source maintainers who want agent instructions to be treated like other reviewed artefacts

## What AgentSpec does not claim

AgentSpec does not provide deterministic control over AI systems. Model-backed agents can still behave unexpectedly because outputs depend on model behaviour, runtime context, retrieval, tools and deployment configuration.

AgentSpec is engineering assurance, not a guarantee. It helps teams structure instructions, find common problems, test expected routing behaviour and review changes before deployment.
