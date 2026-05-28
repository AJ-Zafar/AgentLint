# @agentspec/compiler

Experimental deterministic natural language compiler for Agent Lint.

## Status

This package uses simple local parsing heuristics. It does not call external LLM APIs and should not be treated as a complete natural language understanding system.

## What it extracts

- Primary goal
- Positive and negative rules
- Safety, privacy, compliance, escalation and data access constraints
- Tool references
- Route conditions
- Handoff rules
- Ambiguity warnings
- Confidence metadata for inferred fields

## CLI

```bash
pnpm agentlint compile ./instructions.md
```

The command prints structured Agent Lint YAML with a `compiler` metadata block containing confidence scores, inferred fields and unresolved ambiguity warnings.
