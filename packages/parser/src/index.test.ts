import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAgentSpecFile, parseAgentSpecYaml } from "./index";

const yamlSpec = `
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
    - Escalate threats of harm to human-support.
  privacy:
    - Never expose passwords, secrets, or full payment card numbers.
  compliance:
    - Follow the published refund policy.
  escalation:
    - Fallback to human-support when policy coverage is unclear.
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
    condition: Policy exception, unclear account ownership, or refund approval required.
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
      - Does not ask for full payment card details.
`;

describe("AgentSpec parser", () => {
  it("parses first-version YAML text into a typed AgentSpec document", () => {
    const parsed = parseAgentSpecYaml(yamlSpec);

    expect(parsed.document.agent.name).toBe("Customer Support Agent");
    expect(parsed.document.routes[0]?.triggers).toContain("refund");
    expect(parsed.source).toBe("inline");
  });

  it("loads .agentspec.yaml files from disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentspec-parser-"));
    const filePath = join(directory, "support.agentspec.yaml");
    await writeFile(filePath, yamlSpec, "utf8");

    const parsed = await parseAgentSpecFile(filePath);

    expect(parsed.source).toBe(filePath);
    expect(parsed.document.agent.owner).toBe("support-operations");
  });

  it("throws a validation error with readable issue paths", () => {
    expect(() =>
      parseAgentSpecYaml(`
agent:
  name: Broken Agent
  description: Missing persona.
  version: 1.0.0
  owner: platform
  domain: test
instructions:
  primary_goal: Help users.
  secondary_goals: []
  do: []
  do_not: []
constraints:
  safety: []
  privacy: []
  compliance: []
  escalation: []
  data_access: []
tools: []
routes: []
handoffs: []
`)
    ).toThrow(/persona/);
  });
});
