import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAgentSpecFile, parseAgentSpecYaml } from "./index";

const yamlSpec = `
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
      properties:
        accountId:
          type: string
      required:
        - accountId
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

describe("AgentSpec parser", () => {
  it("parses YAML text into a typed AgentSpec document", () => {
    const parsed = parseAgentSpecYaml(yamlSpec);

    expect(parsed.document.agent.id).toBe("customer-support");
    expect(parsed.document.routes[0]?.tools).toEqual(["lookup-account"]);
    expect(parsed.source).toBe("inline");
  });

  it("loads .agentspec.yaml files from disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentspec-parser-"));
    const filePath = join(directory, "support.agentspec.yaml");
    await writeFile(filePath, yamlSpec, "utf8");

    const parsed = await parseAgentSpecFile(filePath);

    expect(parsed.source).toBe(filePath);
    expect(parsed.document.metadata.name).toBe("Customer Support Agent");
  });

  it("throws a validation error with readable issue paths", () => {
    expect(() =>
      parseAgentSpecYaml(`
agentspec: "1.0"
metadata:
  name: Broken Agent
  version: 0.1.0
agent:
  id: broken
  description: Missing fallback.
instructions:
  system: Help users.
  goals: []
  constraints: []
routes: []
tools: []
escalations: []
`)
    ).toThrow(/instructions\.fallback/);
  });
});
