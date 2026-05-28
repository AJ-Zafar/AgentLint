import { describe, expect, it } from "vitest";
import { analyzeAgentSpecText } from "./analysis";

const validSpec = `
agent:
  name: Extension Fixture Agent
  description: Valid extension fixture.
  version: 1.0.0
  owner: qa
  domain: vscode
persona:
  role: Editor assistant
  tone: neutral
  verbosity: concise
  style_rules:
    - Keep diagnostics clear.
instructions:
  primary_goal: Route support requests using declared paths.
  secondary_goals:
    - Preserve privacy.
  do:
    - Use declared tools only.
  do_not:
    - Do not expose secrets.
constraints:
  safety:
    - Escalate safety concerns to human_support.
  privacy:
    - Never expose protected data.
  compliance:
    - Follow policy.
  escalation:
    - Fallback to human_support when ownership is unclear.
  data_access:
    - Only read approved account fields.
tools:
  - name: account_lookup
    description: Reads account status.
    allowed_operations:
      - read_account
    forbidden_operations:
      - expose_secrets
    requires_auth: true
    risk_level: low
routes:
  - name: billing_support
    description: Handles billing issues.
    triggers:
      - invoice
      - refund
    target: tool:account_lookup
    priority: 10
  - name: fallback_human_support
    description: Fallback route for unclear ownership.
    triggers:
      - fallback
      - unclear
    target: handoff:human_support
    priority: 100
handoffs:
  - name: human_support
    condition: Ownership unclear or policy exception.
    destination: queue:human-support
    required_context:
      - account_id
tests:
  - name: billing route
    input: Can I get a refund for my invoice?
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - route is billing_support
`;

describe("VS Code extension AgentSpec analysis", () => {
  it("returns no diagnostics for a valid and lint-clean AgentSpec", () => {
    const result = analyzeAgentSpecText(validSpec, "valid.agentspec.yaml");

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("returns validation diagnostics for parser errors", () => {
    const result = analyzeAgentSpecText("agent:\n  name: Missing required sections\n", "broken.agentspec.yaml");

    expect(result.valid).toBe(false);
    expect(result.validationDiagnostics[0]).toMatchObject({
      source: "agentspec",
      severity: "error"
    });
    expect(result.validationDiagnostics.map((diagnostic) => diagnostic.path)).toContain("persona");
  });

  it("returns linter diagnostics without duplicating linter logic", () => {
    const lintySpec = validSpec.replace("primary_goal: Route support requests using declared paths.", "primary_goal: \"\"");
    const result = analyzeAgentSpecText(lintySpec, "linty.agentspec.yaml");

    expect(result.valid).toBe(true);
    expect(result.lintDiagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "missing-primary-goal",
        path: "instructions.primary_goal"
      })
    ]);
    expect(result.lintDiagnostics[0]?.message).toContain("Instructions must define a primary goal");
  });
});
