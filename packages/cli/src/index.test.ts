import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./index";

const validYaml = `
agentspec: "1.0"
metadata:
  name: Customer Support Agent
  version: 0.1.0
agent:
  id: customer-support
  description: Handles support requests.
instructions:
  system: Resolve customer requests using approved policies.
  goals:
    - Route billing requests to billing.
  constraints:
    - Never request full payment card numbers.
  fallback: Escalate unclear requests to human-support.
routes:
  - id: billing
    when: Customer asks about invoices or refunds.
    instructions:
      - Confirm the account identifier.
    tools:
      - lookup-account
    escalateTo: human-support
tools:
  - id: lookup-account
    description: Fetches account metadata from a local fixture.
    inputSchema:
      type: object
escalations:
  - id: human-support
    when: Human approval is required.
    target: queue:human-support
tests:
  - id: billing-route
    input: I need a refund.
    expect:
      route: billing
      escalation: human-support
`;

const lintYaml = validYaml.replace("lookup-account", "missing-tool");

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

  it("lints AgentSpec YAML files and returns non-zero for issues", async () => {
    const filePath = await writeFixture("lint.agentspec.yaml", lintYaml);
    const result = await runCli(["lint", filePath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("undefined-tool");
  });

  it("runs deterministic declared tests without live model calls", async () => {
    const filePath = await writeFixture("test.agentspec.yaml", validYaml);
    const result = await runCli(["test", filePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1 passed");
  });

  it("diffs two AgentSpec YAML files", async () => {
    const oldPath = await writeFixture("old.agentspec.yaml", validYaml);
    const newPath = await writeFixture(
      "new.agentspec.yaml",
      validYaml.replace("Customer Support Agent", "Customer Care Agent")
    );

    const result = await runCli(["diff", oldPath, newPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("metadata.name");
  });
});
