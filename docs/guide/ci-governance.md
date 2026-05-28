---
title: CI governance gates
---

# CI governance gates

AgentSpec can be used as a governance gate before changes to agent instructions are merged.

The goal is not to prove that an AI system will behave deterministically. The goal is to make instruction changes visible, structured and checked before they reach a runtime environment.

## What the gate should check

A basic CI gate should:

1. validate every `.agentspec.yaml` and `.agentspec.yml` file
2. lint every spec for instruction design issues
3. run deterministic tests declared in each spec
4. fail the pipeline when validation, linting or tests fail

This catches common problems before review or deployment, including:

- invalid YAML or schema errors
- missing goals, fallback routes or escalation paths
- undefined tools or handoffs
- high-risk tools without authentication requirements
- changed routing expectations that break deterministic tests

## Example GitHub Actions workflow

A complete example is available at:

```text
examples/github-actions/agentspec-check.yml
```

Copy it into a repository as:

```text
.github/workflows/agentspec-check.yml
```

The workflow:

- installs pnpm and Node.js
- installs dependencies
- builds the AgentSpec CLI
- validates all tracked AgentSpec files
- lints all tracked AgentSpec files
- runs deterministic tests for all tracked AgentSpec files
- fails the pull request if any command exits non-zero

The example excludes package fixture files under `packages/**/fixtures/**` and intentional bad example files matching `*.bad.agentspec.yaml`, because those files are designed to demonstrate failures. Adjust the path filter if your repository stores production AgentSpec files elsewhere.

## Example validation step

```yaml
- name: Validate AgentSpec files
  run: |
    set -euo pipefail
    mapfile -t files < <(git ls-files -- '*.agentspec.yaml' '*.agentspec.yml' ':(exclude)packages/**/fixtures/**' ':(exclude)**/*.bad.agentspec.yaml')
    for file in "${files[@]}"; do
      pnpm agentspec validate "$file" --json
    done
```

Using `--json` makes the output stable for CI/CD log processing and future reporting integrations.

## Governance pattern

For teams managing production agents, AgentSpec checks can be used as a required status check on pull requests. A typical policy might be:

- any change to an AgentSpec file must pass validation, linting and tests
- high or breaking behavioural diffs require review from an agent platform owner
- changes to tools, risk levels, handoffs or escalation conditions require security or governance review
- test additions are encouraged when adding routes or changing triggers

AgentSpec does not replace human review. It gives reviewers a better starting point by making behavioural changes explicit and by catching avoidable errors automatically.

## Recommended pull request workflow

1. Author updates an AgentSpec file.
2. CI validates, lints and tests all AgentSpec files.
3. Reviewers inspect any behavioural diff output for changed goals, tools, routes, fallback behaviour and escalation conditions.
4. Required reviewers approve changes that affect tool access, safety, privacy or compliance boundaries.
5. The agent implementation or platform configuration is updated separately.

## Enterprise considerations

Enterprise teams may want to extend the basic workflow with:

- artifact upload for JSON lint/test/diff reports
- branch protection requiring AgentSpec checks
- code owners for agent domains or high-risk tools
- policy packs for regulated domains
- release notes generated from behavioural diffs
- audit evidence linking AgentSpec changes to approvals

The current open-source workflow is deliberately simple. It is intended to be easy to copy, review and adapt.
