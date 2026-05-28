# @agentspec/grammar

Formal grammar and behaviour graph compilation for Agent Lint specs.

## Experimental features

- Structured condition expressions with `all`, `any` and `not`.
- Condition operators: `==`, `!=`, `<`, `<=`, `>` and `>=`.
- Route dependency validation.
- Route precedence validation.
- Constraint evaluation trees.
- Internal behaviour graph compilation.

This package is local-first and deterministic. It does not evaluate a live agent or call an LLM.
