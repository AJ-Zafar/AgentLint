import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./index";

const validYaml = `
agent:
  name: Customer Support Agent
  description: Routes customer support requests.
  version: 1.0.0
  owner: support-operations
  domain: customer-support
persona:
  role: Policy-grounded support triage assistant
  tone: calm and professional
  verbosity: concise
  style_rules:
    - Use plain language.
instructions:
  primary_goal: Classify support requests and choose an approved route.
  secondary_goals:
    - Collect only required account context.
  do:
    - Use declared routes before answering.
  do_not:
    - Do not request full payment card numbers.
constraints:
  safety:
    - Escalate threats of harm to human_support.
  privacy:
    - Never expose passwords, secrets, or full payment card numbers.
  compliance:
    - Follow the published refund policy.
  escalation:
    - Fallback to human_support when policy coverage is unclear.
  data_access:
    - Only use account fields returned by approved tools.
tools:
  - name: account_lookup
    description: Reads account status from a local fixture.
    allowed_operations:
      - read_account_status
    forbidden_operations:
      - read_full_payment_card
    requires_auth: true
    risk_level: medium
routes:
  - name: billing_support
    description: Handles invoices, subscriptions, and refund policy questions.
    triggers:
      - invoice
      - refund
      - subscription
      - payment
    target: tool:account_lookup
    priority: 10
handoffs:
  - name: human_support
    condition: Refund approval, unclear account ownership, or policy exception.
    destination: queue:human-support
    required_context:
      - account_id
      - request_summary
tests:
  - name: billing refund route
    input: Can I get a refund for my latest invoice?
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - route is billing_support
      - handoff is human_support
      - calls tool account_lookup
`;

const lintYaml = validYaml.replace("target: tool:account_lookup", "target: tool:missing_tool");

async function writeFixture(name: string, contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentspec-cli-"));
  const filePath = join(directory, name);
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

describe("agentspec CLI", () => {
  it("shows help with a zero exit code", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: agentspec");
  });

  it("validates AgentSpec YAML files", async () => {
    const filePath = await writeFixture("valid.agentspec.yaml", validYaml);
    const result = await runCli(["validate", filePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("valid");
  });

  it("emits deterministic JSON for validate", async () => {
    const filePath = await writeFixture("valid-json.agentspec.yaml", validYaml);
    const result = await runCli(["validate", filePath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed).toEqual({
      command: "validate",
      file: filePath,
      valid: true,
      diagnostics: []
    });
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });

  it("emits deterministic JSON for invalid validate", async () => {
    const filePath = await writeFixture("invalid-json.agentspec.yaml", "agent:\n  name: Broken\n");
    const result = await runCli(["validate", filePath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.command).toBe("validate");
    expect(parsed.file).toBe(filePath);
    expect(parsed.valid).toBe(false);
    expect(parsed.diagnostics[0]).toMatchObject({ severity: "error", path: "agent.description" });
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });

  it("lints AgentSpec YAML files with grouped terminal output", async () => {
    const filePath = await writeFixture("lint.agentspec.yaml", lintYaml);
    const result = await runCli(["lint", filePath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Errors");
    expect(result.stdout).toContain("Warnings");
    expect(result.stdout).toContain("route-target-not-defined");
    expect(result.stdout).toContain("missing-fallback-route");
    expect(result.stdout).toContain("Suggestion:");
  });

  it("emits deterministic JSON for lint", async () => {
    const filePath = await writeFixture("lint-json.agentspec.yaml", lintYaml);
    const result = await runCli(["lint", filePath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.command).toBe("lint");
    expect(parsed.file).toBe(filePath);
    expect(parsed.success).toBe(false);
    expect(parsed.issueCount).toBe(parsed.issues.length);
    expect(parsed.issues.map((issue: { ruleId: string }) => issue.ruleId)).toContain("route-target-not-defined");
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });


  it("lints with a built-in policy pack", async () => {
    const result = await runCli(["lint", "examples/public-sector-casework.agentspec.yaml", "--policy", "public-sector-safe"], "agentlint");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no lint issues");
  });

  it("reports policy pack findings in JSON output", async () => {
    const filePath = await writeFixture(
      "policy-json.agentspec.yaml",
      validYaml.replace("Fallback to human_support when policy coverage is unclear.", "Use normal support when unclear.")
    );
    const result = await runCli(["lint", filePath, "--policy", "public-sector-safe", "--json"], "agentlint");
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.policyPacks).toEqual(["public-sector-safe"]);
    expect(parsed.issues).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "policy-required-constraint" })]));
  });

  it("runs deterministic declared tests without live model calls", async () => {
    const filePath = await writeFixture("test.agentspec.yaml", validYaml);
    const result = await runCli(["test", filePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("AgentSpec Test Results");
    expect(result.stdout).toContain("Passed (1)");
    expect(result.stdout).toContain("Summary: 1/1 passed, 0 failed, score 100%");
  });

  it("emits deterministic JSON for test", async () => {
    const filePath = await writeFixture("test-json.agentspec.yaml", validYaml);
    const result = await runCli(["test", filePath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      command: "test",
      file: filePath,
      success: true,
      summary: { total: 1, passed: 1, failed: 0, score: 100 }
    });
    expect(parsed.tests[0]).toMatchObject({ name: "billing refund route", passed: true });
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });

  it("fails deterministic declared tests when a defined expected route does not match the simulated route", async () => {
    const wrongRouteYaml = validYaml
      .replace(
        "routes:\n  - name: billing_support",
        "routes:\n  - name: technical_support\n    description: Handles device setup and app troubleshooting.\n    triggers:\n      - device\n      - app\n      - technical\n    target: handoff:human_support\n    priority: 5\n  - name: billing_support"
      )
      .replace("expected_route: billing_support", "expected_route: technical_support");
    const filePath = await writeFixture("wrong-route.agentspec.yaml", wrongRouteYaml);

    const result = await runCli(["test", filePath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Failed (1)");
    expect(result.stdout).toContain("Reason: route-mismatch");
    expect(result.stdout).toContain('Expected: "technical_support"');
    expect(result.stdout).toContain('Actual: "billing_support"');
  });




  it("compiles loose instructions into Agent Lint YAML", async () => {
    const result = await runCli(["compile", "packages/compiler/fixtures/support-instructions.md"], "agentlint");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("generated_by: agentlint-natural-language-compiler");
    expect(result.stdout).toContain("primary_goal: Help customers with refund and invoice questions using");
    expect(result.stdout).toContain("policy-approved routes.");
    expect(result.stdout).toContain("confidence:");
    expect(result.stdout).toContain("warnings:");
  });

  it("prints a compiled behaviour graph using the agentlint alias", async () => {
    const filePath = await writeFixture(
      "graph.agentspec.yaml",
      validYaml.replace(
        "priority: 10",
        "priority: 10\n    conditions:\n      all:\n        - intent == refund\n        - authenticated == true\n        - amount < 50"
      )
    );

    const result = await runCli(["graph", filePath, "--json"], "agentlint");
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("graph");
    expect(parsed.file).toBe(filePath);
    expect(parsed.diagnostics.every((diagnostic: { severity: string }) => diagnostic.severity !== "error")).toBe(true);
    expect(parsed.graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "route:billing_support" })]));
  });



  it("prints Mermaid and ASCII behaviour graph formats", async () => {
    const filePath = await writeFixture("graph-formats.agentspec.yaml", validYaml);

    const mermaid = await runCli(["graph", filePath, "--mermaid"], "agentlint");
    const ascii = await runCli(["graph", filePath, "--ascii"], "agentlint");

    expect(mermaid.exitCode).toBe(0);
    expect(mermaid.stdout).toContain("flowchart LR");
    expect(mermaid.stdout).toContain("route_billing_support");
    expect(ascii.exitCode).toBe(0);
    expect(ascii.stdout).toContain("Agent Lint Behaviour Graph");
    expect(ascii.stdout).toContain("conditional_transition");
  });

  it("generates a Copilot Studio implementation plan", async () => {
    const result = await runCli(["copilot-plan", "examples/copilot-studio-agent.agentspec.yaml"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# Copilot Studio Implementation Plan: Copilot Studio Readiness Agent");
    expect(result.stdout).toContain("## Topics");
    expect(result.stdout).toContain("## Power Automate Flows");
    expect(result.stdout).toContain("No Microsoft APIs are called");
  });

  it("emits deterministic JSON for copilot-plan", async () => {
    const filePath = "examples/copilot-studio-agent.agentspec.yaml";
    const result = await runCli(["copilot-plan", filePath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("copilot-plan");
    expect(parsed.file).toBe(filePath);
    expect(parsed.format).toBe("markdown");
    expect(parsed.markdown).toContain("# Copilot Studio Implementation Plan: Copilot Studio Readiness Agent");
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });



  it("extracts a Copilot Studio solution into an Agent Lint spec", async () => {
    const result = await runCli(["copilot-extract", "packages/copilot-studio-audit/fixtures/fake-solution.zip"], "agentlint");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("name: Copilot Studio Readiness Agent");
    expect(result.stdout).toContain("deployment_readiness");
    expect(result.stdout).toContain("delete_environment");
  });

  it("reports Copilot Studio drift", async () => {
    const result = await runCli([
      "copilot-drift",
      "--spec",
      "examples/copilot-studio-agent.agentspec.yaml",
      "--solution",
      "packages/copilot-studio-audit/fixtures/fake-solution.zip",
      "--json"
    ], "agentlint");
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("copilot-drift");
    expect(parsed.drift.summary.driftCount).toBe(3);
    expect(parsed.drift.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: "missing-topic", name: "connector_review" })]));
  });

  it("audits a Copilot Studio solution export", async () => {
    const result = await runCli([
      "copilot-audit",
      "--spec",
      "examples/copilot-studio-agent.agentspec.yaml",
      "--solution",
      "packages/copilot-studio-audit/fixtures/fake-solution.zip"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Copilot Studio Audit Report");
    expect(result.stdout).toContain("Status: experimental");
    expect(result.stdout).toContain("Expected but missing topics");
    expect(result.stdout).toContain("connector_review");
    expect(result.stdout).toContain("High-risk tools not documented in AgentSpec");
    expect(result.stdout).toContain("delete_environment");
  });

  it("emits deterministic JSON for copilot-audit", async () => {
    const result = await runCli([
      "copilot-audit",
      "--spec",
      "examples/copilot-studio-agent.agentspec.yaml",
      "--solution",
      "packages/copilot-studio-audit/fixtures/fake-solution.zip",
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("copilot-audit");
    expect(parsed.specFile).toBe("examples/copilot-studio-agent.agentspec.yaml");
    expect(parsed.solutionFile).toBe("packages/copilot-studio-audit/fixtures/fake-solution.zip");
    expect(parsed.report.findings.expectedMissingTopics).toEqual(["connector_review"]);
    expect(parsed.report.findings.highRiskToolsNotDocumentedInAgentSpec).toEqual([{ name: "delete_environment", riskLevel: "critical", requiresAuthentication: true, operations: ["delete_environment"] }]);
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });


  it("simulates behavioural diff changes", async () => {
    const result = await runCli([
      "simulate-diff",
      "packages/diff/fixtures/old.agentspec.yaml",
      "packages/diff/fixtures/new.agentspec.yaml"
    ], "agentlint");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Agent Lint Simulated Behavioural Diff");
    expect(result.stdout).toContain("Behavioural impact: breaking");
    expect(result.stdout).toContain("Likely regression areas");
    expect(result.stdout).toContain("fallback coverage");
  });

  it("emits deterministic JSON for simulate-diff", async () => {
    const result = await runCli([
      "simulate-diff",
      "packages/diff/fixtures/old.agentspec.yaml",
      "packages/diff/fixtures/new.agentspec.yaml",
      "--json"
    ], "agentlint");
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("simulate-diff");
    expect(parsed.report.impact).toBe("breaking");
    expect(parsed.report.summary.changedScenarioCount).toBeGreaterThan(0);
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });

  it("diffs two AgentSpec YAML files with a behavioral report", async () => {
    const oldPath = await writeFixture("old.agentspec.yaml", validYaml);
    const newPath = await writeFixture(
      "new.agentspec.yaml",
      validYaml
        .replace("Classify support requests and choose an approved route.", "Resolve support requests automatically when confidence is high.")
        .replace("risk_level: medium", "risk_level: high")
        .replace("- refund", "- subscription")
    );

    const result = await runCli(["diff", oldPath, newPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("AgentSpec Behavioral Diff");
    expect(result.stdout).toContain("Overall impact: high");
    expect(result.stdout).toContain("changed-primary-goal");
    expect(result.stdout).toContain("increased-tool-risk");
    expect(result.stdout).toContain("changed-route-triggers");
  });

  it("supports JSON diff output", async () => {
    const oldPath = await writeFixture("old-json.agentspec.yaml", validYaml);
    const newPath = await writeFixture(
      "new-json.agentspec.yaml",
      validYaml.replace("Classify support requests and choose an approved route.", "Resolve support requests automatically when confidence is high.")
    );

    const result = await runCli(["diff", oldPath, newPath, "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.command).toBe("diff");
    expect(parsed.oldFile).toBe(oldPath);
    expect(parsed.newFile).toBe(newPath);
    expect(parsed.impact).toBe("high");
    expect(parsed.changes[0]).toMatchObject({ type: "changed-primary-goal", impact: "high" });
    expect(result.stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });
});
