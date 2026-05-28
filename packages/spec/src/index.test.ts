import { describe, expect, it } from "vitest";
import {
  agentSpecJsonSchema,
  agentSpecSchema,
  validateAgentSpec,
  type AgentSpecDocument
} from "./index";

const validSpec: AgentSpecDocument = {
  agentspec: "1.0",
  metadata: {
    name: "Customer Support Agent",
    version: "0.1.0"
  },
  agent: {
    id: "customer-support",
    description: "Handles support requests and escalates risky cases."
  },
  instructions: {
    system: "Resolve customer requests using policy-grounded answers.",
    goals: ["Route billing requests to billing support."],
    constraints: ["Never request full payment card numbers."],
    fallback: "If policy is unclear, escalate to human-support."
  },
  routes: [
    {
      id: "billing",
      when: "The customer asks about invoices, refunds, or payments.",
      instructions: ["Collect account context before answering."],
      tools: ["lookup-account"],
      escalateTo: "human-support"
    }
  ],
  tools: [
    {
      id: "lookup-account",
      description: "Fetches account metadata from a local fixture.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" }
        },
        required: ["accountId"]
      }
    }
  ],
  escalations: [
    {
      id: "human-support",
      when: "The request requires human approval.",
      target: "queue:human-support"
    }
  ],
  tests: [
    {
      id: "routes-billing-questions",
      input: "Can you explain my invoice?",
      expect: {
        route: "billing",
        escalation: "human-support"
      }
    }
  ]
};

describe("AgentSpec schema", () => {
  it("accepts a complete deterministic agent specification", () => {
    const result = validateAgentSpec(validSpec);

    expect(result.success).toBe(true);
    expect(agentSpecSchema.parse(validSpec).agent.id).toBe("customer-support");
  });

  it("rejects specs without fallback behavior", () => {
    const invalid = {
      ...validSpec,
      instructions: {
        ...validSpec.instructions,
        fallback: undefined
      }
    };

    const result = validateAgentSpec(invalid);

    expect(result.success).toBe(false);
    expect(result.issues[0]?.path).toContain("instructions.fallback");
  });

  it("publishes a JSON schema for editor and CLI validation", () => {
    expect(agentSpecJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(agentSpecJsonSchema.required).toContain("instructions");
    expect(agentSpecJsonSchema.properties.routes.items.required).toContain("id");
  });
});
