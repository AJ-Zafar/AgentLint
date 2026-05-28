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
  it("validates AgentSpec YAML files", async () => {
    const filePath = await writeFixture("valid.agentspec.yaml", validYaml);
    const result = await runCli(["validate", filePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("valid");
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

  it("runs deterministic declared tests without live model calls", async () => {
    const filePath = await writeFixture("test.agentspec.yaml", validYaml);
    const result = await runCli(["test", filePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("AgentSpec Test Results");
    expect(result.stdout).toContain("Passed (1)");
    expect(result.stdout).toContain("Summary: 1/1 passed, 0 failed, score 100%");
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

  it("diffs two AgentSpec YAML files", async () => {
    const oldPath = await writeFixture("old.agentspec.yaml", validYaml);
    const newPath = await writeFixture(
      "new.agentspec.yaml",
      validYaml.replace("Customer Support Agent", "Customer Care Agent")
    );

    const result = await runCli(["diff", oldPath, newPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("agent.name");
  });
});
