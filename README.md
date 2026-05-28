# AgentSpec

AgentSpec is a local-first TypeScript monorepo for writing, validating, linting, testing, and diffing structured AI agent instructions.

This project is infrastructure for instruction engineering, not a chatbot. All commands are deterministic and run without live LLM calls.

## Packages

- `@agentspec/spec` - TypeScript types, JSON schema, and Zod runtime validation.
- `@agentspec/parser` - Loads `.agentspec.yaml` files and returns typed documents.
- `@agentspec/linter` - Finds common instruction-engineering issues.
- `@agentspec/cli` - Commander-based CLI exposing `validate`, `lint`, `test`, and `diff`.

## Commands

```bash
pnpm install
pnpm test
pnpm build

pnpm agentspec validate examples/customer-support.agentspec.yaml
pnpm agentspec lint examples/customer-support.agentspec.yaml
pnpm agentspec test examples/customer-support.agentspec.yaml
pnpm agentspec diff examples/customer-support.agentspec.yaml examples/copilot-studio-agent.agentspec.yaml
```

## AgentSpec shape

AgentSpec files use YAML and currently target schema version `1.0`:

- `metadata` describes the spec.
- `agent` identifies the agent being specified.
- `instructions` contains system behavior, goals, constraints, and fallback behavior.
- `routes` define deterministic routing paths.
- `tools` define local tool contracts.
- `escalations` define human or workflow handoff targets.
- `tests` declare deterministic expectations checked locally by the CLI.
