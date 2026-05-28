# @agentspec/replay

Deterministic scenario replay engine for Agent Lint behaviour graphs.

## What it does

- Finds a named scenario from `scenarios` or a declared test.
- Evaluates constraint and route conditions against scenario context.
- Selects the first matching route by priority.
- Reports decision path, triggered constraints, selected route, tool eligibility and handoff reasoning.
- Produces a step-by-step execution trace.

No LLM calls are made. Replay is a local structural evaluation over the Agent Lint spec.
