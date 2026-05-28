# Agent Lint VS Code Extension

Language Server Protocol support for `.agentspec.yaml` and `.agentspec.yml` files.

## Status

Experimental. The extension is intended to provide fast local feedback while the Agent Lint format and rule set evolve.

## Features

- Language Server Protocol client/server architecture.
- Autocomplete for Agent Lint sections, condition keys and route/tool/handoff references.
- Hover documentation for core Agent Lint sections.
- Inline validation and linter diagnostics from the existing parser and linter packages.
- Quick fixes for supported lint diagnostics.
- Go-to definition for route, tool and handoff references.
- Schema-aware completion snippets for routes and targets.
- Graph preview panel for the active spec.
- Test run command for the active spec.
- Diff compare command for comparing the active spec with another Agent Lint file.

## Commands

- `AgentSpec: Validate Current File`
- `AgentSpec: Lint Current File`
- `AgentSpec: Preview Behaviour Graph`
- `AgentSpec: Run Tests`
- `AgentSpec: Compare Current File`

## Development

```bash
pnpm install
pnpm --filter agentspec-vscode build
pnpm --filter agentspec-vscode test
```

The extension reuses `@agentspec/parser`, `@agentspec/linter`, `@agentspec/grammar`, `@agentspec/test-runner` and `@agentspec/diff`. It does not duplicate core Agent Lint logic.
