import { describe, expect, it } from "vitest";
import { builtinPolicyPacks, lintAgentSpec, lintRules, type LintRuleId } from "./index";
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
    do_not: ["Do not disclose protected personal data.", "Do not read full payment card data."]
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
      forbidden_operations: ["read_full_payment_card"],
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
    },
    {
      name: "fallback_escalation",
      description: "Fallback route for unclear authority or policy gaps.",
      triggers: ["fallback", "unclear", "policy gap"],
      target: "handoff:senior_caseworker",
      priority: 100
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
  tests: [
    {
      name: "safeguarding route",
      input: "This case has urgent safeguarding concerns.",
      expected_route: "safeguarding_review",
      expected_handoff: "senior_caseworker",
      expected_tool_calls: ["case_lookup"],
      forbidden_tool_calls: [],
      assertions: ["Does not disclose protected personal data."]
    }
  ]
};

const withSpec = (overrides: Partial<AgentSpecDocument>): AgentSpecDocument => ({ ...baseSpec, ...overrides });
const ruleIds = (spec: AgentSpecDocument): LintRuleId[] => lintAgentSpec(spec).issues.map((issue) => issue.ruleId);
const issueFor = (spec: AgentSpecDocument, ruleId: LintRuleId) => lintAgentSpec(spec).issues.find((issue) => issue.ruleId === ruleId);

describe("AgentSpec rule-based linter", () => {
  it("returns normalized issue metadata", () => {
    const issue = issueFor(withSpec({ instructions: { ...baseSpec.instructions, primary_goal: "" } }), "missing-primary-goal");

    expect(issue).toMatchObject({
      ruleId: "missing-primary-goal",
      severity: "error",
      path: "instructions.primary_goal"
    });
    expect(issue?.suggestion).toContain("primary_goal");
    expect(issue?.confidence).toBeGreaterThan(0.9);
  });

  it("reports missing-primary-goal", () => {
    expect(ruleIds(withSpec({ instructions: { ...baseSpec.instructions, primary_goal: "" } }))).toContain("missing-primary-goal");
  });

  it("reports conflicting-do-and-do-not", () => {
    const spec = withSpec({
      instructions: {
        ...baseSpec.instructions,
        do: ["Approve refund requests"],
        do_not: ["Do not approve refund requests"]
      }
    });

    expect(ruleIds(spec)).toContain("conflicting-do-and-do-not");
  });

  it("reports route-target-not-defined", () => {
    const spec = withSpec({ routes: [{ ...baseSpec.routes[0], target: "tool:missing_tool" }, baseSpec.routes[1]] });

    expect(ruleIds(spec)).toContain("route-target-not-defined");
  });

  it("reports handoff-without-condition", () => {
    const spec = withSpec({ handoffs: [{ ...baseSpec.handoffs[0], condition: "" }] });

    expect(ruleIds(spec)).toContain("handoff-without-condition");
  });

  it("reports missing-fallback-route", () => {
    const spec = withSpec({ routes: [baseSpec.routes[0]] });

    expect(ruleIds(spec)).toContain("missing-fallback-route");
  });

  it("reports tool-without-risk-level", () => {
    const tool = { ...baseSpec.tools[0] } as AgentSpecDocument["tools"][number];
    delete (tool as { risk_level?: unknown }).risk_level;

    expect(ruleIds(withSpec({ tools: [tool] }))).toContain("tool-without-risk-level");
  });

  it("reports high-risk-tool-without-auth", () => {
    const spec = withSpec({ tools: [{ ...baseSpec.tools[0], requires_auth: false, risk_level: "critical" }] });

    expect(ruleIds(spec)).toContain("high-risk-tool-without-auth");
  });

  it("reports vague-instruction-language", () => {
    const spec = withSpec({
      instructions: {
        ...baseSpec.instructions,
        secondary_goals: ["Use best judgment and be careful."]
      }
    });

    expect(ruleIds(spec)).toContain("vague-instruction-language");
  });

  it("reports duplicate-route-trigger", () => {
    const spec = withSpec({
      routes: [
        baseSpec.routes[0],
        baseSpec.routes[1],
        {
          name: "duplicate_safeguarding",
          description: "Duplicates a trigger.",
          triggers: ["Safeguarding"],
          target: "handoff:senior_caseworker",
          priority: 50
        }
      ]
    });

    expect(ruleIds(spec)).toContain("duplicate-route-trigger");
  });

  it("reports test-without-assertions", () => {
    const spec = withSpec({ tests: [{ ...baseSpec.tests![0], assertions: [] }] });

    expect(ruleIds(spec)).toContain("test-without-assertions");
  });

  it("reports forbidden-operation-not-enforced", () => {
    const spec = withSpec({
      instructions: { ...baseSpec.instructions, do_not: ["Do not disclose protected personal data."] },
      constraints: {
        ...baseSpec.constraints,
        privacy: ["Never disclose protected personal data outside the authorized case context."],
        data_access: ["Only read redacted case summaries from approved tools."]
      }
    });

    expect(ruleIds(spec)).toContain("forbidden-operation-not-enforced");
  });

  it("reports no-escalation-path", () => {
    const spec = withSpec({
      constraints: { ...baseSpec.constraints, escalation: [] },
      routes: [baseSpec.routes[0]],
      handoffs: []
    });

    expect(ruleIds(spec)).toContain("no-escalation-path");
  });



  it("exports built-in policy packs", () => {
    expect(Object.keys(builtinPolicyPacks).sort()).toEqual([
      "financial-services",
      "healthcare",
      "internal-enterprise",
      "public-sector-safe"
    ]);
  });

  it("applies public-sector-safe policy requirements", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      constraints: {
        ...baseSpec.constraints,
        compliance: ["Follow internal policy."],
        privacy: ["Be careful with data."],
        escalation: []
      },
      routes: [baseSpec.routes[0]],
      tools: [
        {
          name: "raw_record_export",
          description: "Exports unrestricted records.",
          allowed_operations: ["export_personal_records"],
          forbidden_operations: [],
          requires_auth: true,
          risk_level: "critical"
        }
      ]
    };

    const issues = lintAgentSpec(spec, { policyPacks: ["public-sector-safe"] }).issues;

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "policy-required-constraint" }),
      expect.objectContaining({ ruleId: "policy-privacy-boundary" }),
      expect.objectContaining({ ruleId: "policy-escalation-required" }),
      expect.objectContaining({ ruleId: "policy-forbidden-tool" }),
      expect.objectContaining({ ruleId: "policy-mandatory-fallback" })
    ]));
  });

  it("passes public-sector-safe policy for the public sector example shape", () => {
    const issues = lintAgentSpec(baseSpec, { policyPacks: ["public-sector-safe"] }).issues;

    expect(issues.filter((issue) => String(issue.ruleId).startsWith("policy-"))).toEqual([]);
  });


  it("detects semantic ambiguity rule categories", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      instructions: {
        ...baseSpec.instructions,
        primary_goal: "Usually resolve requests reasonably and carefully.",
        secondary_goals: ["Escalate if difficult.", "Always escalate but attempt self-resolution first."],
        do: ["Try your best and use judgement.", "Hand off when needed."],
        do_not: ["Escalate if low confidence."]
      },
      constraints: {
        ...baseSpec.constraints,
        escalation: ["Escalate when uncertain."]
      }
    };

    expect(ruleIds(spec)).toEqual(expect.arrayContaining([
      "subjective-qualifier",
      "undefined-escalation-threshold",
      "conflicting-intent-strength",
      "weak-fallback-wording",
      "undefined-confidence-language"
    ] as never[]));
  });

  it("has explanation metadata for semantic ambiguity rules", () => {
    for (const ruleId of [
      "subjective-qualifier",
      "undefined-escalation-threshold",
      "conflicting-intent-strength",
      "weak-fallback-wording",
      "undefined-confidence-language"
    ] as const) {
      const rule = lintRules.find((candidate) => candidate.ruleId === ruleId);
      expect(rule?.docs.whyItMatters).toContain("formal");
      expect(rule?.docs.suggestedFix).toContain("conditions");
    }
  });

  it("has documentation metadata for every rule", () => {
    const requiredFields = ["description", "whyItMatters", "badExample", "goodExample", "suggestedFix"] as const;

    for (const rule of lintRules) {
      expect(rule.severity).toMatch(/^(error|warning|info)$/);
      for (const field of requiredFields) {
        expect(rule.docs[field], `${rule.ruleId}.${field}`).toEqual(expect.any(String));
        expect(rule.docs[field].trim().length, `${rule.ruleId}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it("passes a well-formed local deterministic specification", () => {
    expect(lintAgentSpec(baseSpec).issues).toEqual([]);
  });
});
