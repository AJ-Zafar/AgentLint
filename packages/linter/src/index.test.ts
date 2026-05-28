import { describe, expect, it } from "vitest";
import { lintAgentSpec, type LintIssueCode } from "./index";
import type { AgentSpecDocument } from "@agentspec/spec";

const baseSpec: AgentSpecDocument = {
  agent: {
    name: "Public Sector Casework Agent",
    description: "Routes casework requests to deterministic local workflows.",
    version: "1.0.0",
    owner: "casework-operations",
    domain: "public-sector-casework"
  },
  persona: {
    role: "Casework triage assistant",
    tone: "professional",
    verbosity: "concise",
    style_rules: ["Use minimum necessary case details."]
  },
  instructions: {
    primary_goal: "Route casework requests to the safest approved path.",
    secondary_goals: ["Escalate eligibility decisions."],
    do: ["Use declared routes before answering."],
    do_not: ["Do not disclose protected personal data."]
  },
  constraints: {
    safety: ["Escalate urgent welfare concerns to senior_caseworker."],
    privacy: ["Never disclose protected personal data outside the authorized case context."],
    compliance: ["Follow statutory casework policy."],
    escalation: ["Fallback to senior_caseworker when facts or authority are unclear."],
    data_access: ["Only read redacted case summaries from approved tools."]
  },
  tools: [
    {
      name: "case_lookup",
      description: "Reads redacted case metadata.",
      allowed_operations: ["read_case_summary"],
      forbidden_operations: ["write_eligibility_decision"],
      requires_auth: true,
      risk_level: "high"
    }
  ],
  routes: [
    {
      name: "safeguarding_review",
      description: "Handles urgent safeguarding and welfare indicators.",
      triggers: ["safeguarding", "urgent welfare", "risk of harm"],
      target: "tool:case_lookup",
      priority: 1
    }
  ],
  handoffs: [
    {
      name: "senior_caseworker",
      condition: "Eligibility decision, unclear authority, or urgent safeguarding concern.",
      destination: "queue:senior-caseworker",
      required_context: ["case_id", "risk_summary", "attempted_route"]
    }
  ],
  tests: []
};

const issueCodes = (spec: AgentSpecDocument): LintIssueCode[] =>
  [...new Set(lintAgentSpec(spec).issues.map((issue) => issue.code))].sort();

describe("AgentSpec linter", () => {
  it("reports undefined routes, unused tools, missing fallback behavior, and broken handoffs", () => {
    const problematic: AgentSpecDocument = {
      ...baseSpec,
      constraints: {
        ...baseSpec.constraints,
        escalation: []
      },
      routes: [
        {
          name: "safeguarding_review",
          description: "Handles urgent safeguarding and welfare indicators.",
          triggers: ["safeguarding", "urgent welfare", "risk of harm"],
          target: "handoff:missing_handoff",
          priority: 1
        }
      ],
      tools: [
        ...baseSpec.tools,
        {
          name: "unused_tool",
          description: "Never referenced by executable routes.",
          allowed_operations: ["read_unused"],
          forbidden_operations: [],
          requires_auth: false,
          risk_level: "low"
        }
      ],
      tests: [
        {
          name: "unknown route test",
          input: "Where should this go?",
          expected_route: "not_a_route",
          expected_handoff: "missing_handoff",
          expected_tool_calls: ["missing_tool"],
          forbidden_tool_calls: [],
          assertions: []
        }
      ]
    };

    expect(issueCodes(problematic)).toEqual([
      "missing-fallback-behavior",
      "undefined-handoff",
      "undefined-route",
      "undefined-tool",
      "unused-tool"
    ]);
  });

  it("detects conflicting instructions, ambiguous constraints, and weak safety boundaries", () => {
    const problematic: AgentSpecDocument = {
      ...baseSpec,
      instructions: {
        ...baseSpec.instructions,
        do: ["Approve refunds"],
        do_not: ["Approve refunds"]
      },
      constraints: {
        safety: ["Be careful."],
        privacy: ["Do the right thing."],
        compliance: [],
        escalation: ["Fallback to senior_caseworker, but use best judgment."],
        data_access: []
      }
    };

    expect(issueCodes(problematic)).toEqual([
      "ambiguous-constraint",
      "conflicting-instruction",
      "weak-safety-boundary"
    ]);
  });

  it("does not count test expectations as executable tool or handoff references", () => {
    const problematic: AgentSpecDocument = {
      ...baseSpec,
      tools: [
        ...baseSpec.tools,
        {
          name: "test_only_tool",
          description: "Only appears in a declared test expectation.",
          allowed_operations: ["read_test"],
          forbidden_operations: [],
          requires_auth: false,
          risk_level: "low"
        }
      ],
      handoffs: [
        ...baseSpec.handoffs,
        {
          name: "test_only_handoff",
          condition: "Only appears in a declared test expectation.",
          destination: "queue:test-only",
          required_context: []
        }
      ],
      tests: [
        {
          name: "test-only references",
          input: "This mentions expectations only.",
          expected_route: "safeguarding_review",
          expected_handoff: "test_only_handoff",
          expected_tool_calls: ["test_only_tool"],
          forbidden_tool_calls: [],
          assertions: []
        }
      ]
    };

    expect(issueCodes(problematic)).toEqual(["unreachable-handoff", "unused-tool"]);
  });

  it("passes a well-formed local deterministic specification", () => {
    expect(lintAgentSpec(baseSpec).issues).toEqual([]);
  });
});
