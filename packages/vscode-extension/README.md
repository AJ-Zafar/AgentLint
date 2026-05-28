# AgentSpec VS Code Extension

Adds VS Code support for `.agentspec.yaml` and `.agentspec.yml` files.

## Features

- Recognizes AgentSpec YAML files with the `agentspec` language id.
- Shows parser/Zod validation errors as inline diagnostics.
- Shows linter findings from `@agentspec/linter` as inline diagnostics.
- Provides commands:
  - `AgentSpec: Validate Current File`
  - `AgentSpec: Lint Current File`

The extension reuses `@agentspec/parser` and `@agentspec/linter`; it does not duplicate validation or lint logic.

## Development

```bash
pnpm install
pnpm --filter agentspec-vscode build
pnpm --filter agentspec-vscode test
```

To run locally in VS Code, open this repository, build the package, then launch an Extension Development Host using the extension entry point in `packages/vscode-extension`.
