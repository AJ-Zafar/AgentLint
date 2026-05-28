import { describe, expect, it } from "vitest";
import {
  getAgentLintCodeActions,
  getAgentLintCompletions,
  getAgentLintDefinition,
  getAgentLintDiagnostics,
  getAgentLintHover
} from "./languageFeatures";

const spec = `agent:
  name: Example
  description: Example spec.
  version: 1.0.0
  owner: platform
  domain: support
persona:
  role: Assistant
  tone: clear
  verbosity: concise
  style_rules:
    - Use plain language.
instructions:
  primary_goal: ""
  secondary_goals:
    - Help users.
  do:
    - Use tools.
  do_not:
    - Do not expose secrets.
constraints:
  safety:
    - Escalate risk.
  privacy:
    - Never expose secrets.
  compliance:
    - Follow policy.
  escalation:
    - Fallback to human_support when unclear.
  data_access:
    - Only read approved data.
tools:
  - name: account_lookup
    description: Reads account data.
    allowed_operations:
      - read_account
    forbidden_operations:
      - expose_secrets
    requires_auth: true
    risk_level: medium
routes:
  - name: billing_support
    description: Handles billing.
    triggers:
      - invoice
    target: tool:account_lookup
    priority: 10
  - name: fallback_human_support
    description: Fallback.
    triggers:
      - fallback
    target: handoff:human_support
    priority: 100
handoffs:
  - name: human_support
    condition: Needs human review.
    destination: queue:human
    required_context:
      - summary
tests:
  - name: billing route
    input: invoice help
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - route is billing_support
`;

describe("Agent Lint language features", () => {
  it("provides schema-aware completions", () => {
    const labels = getAgentLintCompletions(spec).map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(["agent", "instructions", "routes", "tools", "handoffs", "conditions", "target: tool:account_lookup"]));
  });

  it("provides hover documentation", () => {
    const hover = getAgentLintHover(spec, 0, 1);

    expect(hover?.contents).toEqual(expect.objectContaining({ value: expect.stringContaining("Agent metadata") }));
  });

  it("publishes parser/linter diagnostics", () => {
    const diagnostics = getAgentLintDiagnostics(spec);

    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-primary-goal" })]));
  });

  it("offers quick fixes for supported diagnostics", () => {
    const diagnostics = getAgentLintDiagnostics(spec);
    const actions = getAgentLintCodeActions(spec, diagnostics);

    expect(actions).toEqual(expect.arrayContaining([expect.objectContaining({ title: expect.stringContaining("primary goal") })]));
  });

  it("goes to route/tool/handoff definitions", () => {
    const routeLine = spec.split("\n").findIndex((line) => line.includes("expected_route: billing_support"));
    const toolLine = spec.split("\n").findIndex((line) => line.includes("target: tool:account_lookup"));

    expect(getAgentLintDefinition(spec, "file:///agent.agentspec.yaml", routeLine, 28)?.range.start.line).toBe(
      spec.split("\n").findIndex((line) => line.includes("name: billing_support"))
    );
    expect(getAgentLintDefinition(spec, "file:///agent.agentspec.yaml", toolLine, 20)?.range.start.line).toBe(
      spec.split("\n").findIndex((line) => line.includes("name: account_lookup"))
    );
  });
});
