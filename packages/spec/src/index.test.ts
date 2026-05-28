import { describe, expect, it } from "vitest";
import {
  agentSpecJsonSchema,
  agentSpecSchema,
  generateAgentSpecJsonSchema,
  validateAgentSpec,
  type AgentSpecDocument
} from "./index";

const validSpec: AgentSpecDocument = {
  agent: {
    name: "Customer Support Agent",
    description: "Routes customer support requests to deterministic local workflows.",
    version: "1.0.0",
    owner: "support-operations",
    domain: "customer-support"
  },
  persona: {
    role: "Policy-grounded support triage assistant",
    tone: "calm and professional",
    verbosity: "concise",
    style_rules: ["Use plain language.", "Summarize next actions as bullets."]
  },
  instructions: {
    primary_goal: "Classify support requests and choose the safest approved route.",
    secondary_goals: ["Collect only required account context.", "Escalate policy exceptions."],
    do: ["Use declared routes before answering.", "Explain when human review is needed."],
    do_not: ["Do not request full payment card numbers.", "Do not invent refund decisions."]
  },
  constraints: {
    safety: ["Escalate threats of harm to human-support."],
    privacy: ["Never expose passwords, secrets, or full payment card numbers."],
    compliance: ["Follow the published refund policy."],
    escalation: ["Fallback to human-support when policy coverage is unclear."],
    data_access: ["Only use account fields returned by approved tools."]
  },
  tools: [
    {
      name: "account_lookup",
      description: "Reads account status from a local fixture.",
      allowed_operations: ["read_account_status", "read_invoice_summary"],
      forbidden_operations: ["write_refund_decision", "read_full_payment_card"],
      requires_auth: true,
      risk_level: "medium"
    }
  ],
  routes: [
    {
      name: "billing_support",
      description: "Handles invoices, subscriptions, and refund policy questions.",
      triggers: ["invoice", "refund", "subscription", "payment"],
      target: "tool:account_lookup",
      priority: 10
    }
  ],
  handoffs: [
    {
      name: "human_support",
      condition: "Policy exception, unclear account ownership, or refund approval required.",
      destination: "queue:human-support",
      required_context: ["account_id", "request_summary", "attempted_route"]
    }
  ],
  tests: [
    {
      name: "billing refund route",
      input: "Can I get a refund for my latest invoice?",
      expected_route: "billing_support",
      expected_handoff: "human_support",
      expected_tool_calls: ["account_lookup"],
      forbidden_tool_calls: [],
      assertions: ["Does not ask for full payment card details."]
    }
  ]
};

describe("AgentSpec v1 schema", () => {
  it("accepts the first-version YAML object shape", () => {
    const result = validateAgentSpec(validSpec);

    expect(result.success).toBe(true);
    expect(agentSpecSchema.parse(validSpec).agent.name).toBe("Customer Support Agent");
  });

  it("rejects missing required first-version fields", () => {
    const invalid = {
      ...validSpec,
      persona: {
        ...validSpec.persona,
        role: undefined
      }
    };

    const result = validateAgentSpec(invalid);

    expect(result.success).toBe(false);
    expect(result.issues[0]?.path).toContain("persona.role");
  });

  it("rejects unknown fields so runtime validation matches editor schema validation", () => {
    const invalid = {
      ...validSpec,
      agent: {
        ...validSpec.agent,
        id: "legacy-field"
      }
    };

    const result = validateAgentSpec(invalid);

    expect(result.success).toBe(false);
    expect(result.issues[0]?.path).toBe("agent");
  });

  it("generates JSON schema for VS Code and CLI consumers", () => {
    const generated = generateAgentSpecJsonSchema();

    expect(generated).toEqual(agentSpecJsonSchema);
    expect(generated.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(generated.required).toContain("persona");
    expect(generated.properties.tools.items.required).toContain("risk_level");
    expect(generated.properties.tests.items.properties.expected_tool_calls.items.type).toBe("string");
  });
});
