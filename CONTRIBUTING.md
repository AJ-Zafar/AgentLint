# Contributing to AgentSpec

Thank you for considering a contribution. AgentSpec is experimental, but the project aims to keep a high standard for deterministic tooling, documentation and examples.

## Development setup

```bash
pnpm install
pnpm test
pnpm build
pnpm docs:build
```

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm validate:examples
pnpm lint:examples
pnpm test:examples
pnpm docs:linter-rules
```

## What to contribute

Good contributions include:

- focused lint rules with metadata and tests
- clearer examples and bad examples for documentation
- improvements to YAML validation and diagnostics
- deterministic test runner assertions
- documentation improvements in UK English
- CI and editor integration improvements

## Pull request guidance

Please keep pull requests focused. Include tests when behaviour changes, update documentation when user-facing commands or schema fields change, and run the verification commands before opening a PR.

For linter rule changes, update rule metadata and regenerate docs with:

```bash
pnpm docs:linter-rules
```

## Project boundaries

Core packages should remain local-first and deterministic. Do not add live LLM calls, Microsoft API calls or external service dependencies to core validation, linting, testing or diff workflows without a clear design discussion.

## Documentation style

Use clear technical writing and UK English. Avoid hype. Be explicit about limitations and do not imply deterministic control over model behaviour.
