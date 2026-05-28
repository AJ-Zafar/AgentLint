---
title: Contributing
---

# Contributing

Contributions are welcome. AgentSpec is intended to be practical open-source infrastructure, so small, well-tested changes are preferred.

## Development setup

```bash
pnpm install
pnpm test
pnpm build
```

Run the docs site locally:

```bash
pnpm docs:dev
```

Build the docs site:

```bash
pnpm docs:build
```

## Good first contributions

Useful areas include:

- improving examples and docs
- adding focused lint rules with tests
- improving YAML diagnostic range mapping
- expanding deterministic test assertions
- adding realistic fixtures for different domains
- improving generated schema descriptions
- tightening TypeScript types

## Contribution expectations

Please aim for changes that are:

- deterministic
- covered by tests when behaviour changes
- clearly documented
- small enough to review carefully
- aligned with the existing package boundaries

Avoid adding live model calls or platform API calls to core packages. AgentSpec should remain local-first by default.

## Writing style

Documentation should use clear technical writing and UK English. Avoid hype. Explain what the tool does, what it does not do and where its limits are.

## Assurance disclaimer

AgentSpec does not provide deterministic AI control. Contributions should preserve that framing. The project provides engineering assurance for agent behaviour, not guarantees about model output.
