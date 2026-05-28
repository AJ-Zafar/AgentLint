import { describe, expect, it } from "vitest";
import type { AgentSpecDocument } from "@agentspec/spec";
import { analyseBehaviouralCoverage } from "./index";

const spec: AgentSpecDocument = {
  agent: { name: "Coverage Agent", description: "Coverage fixture.", version: "1.0.0", owner: "qa", domain: "coverage" },
  persona: { role: "Router", tone: "neutral", verbosity: "concise", style_rules: ["Be clear."] },
  instructions: { primary_goal: "Route requests.", secondary_goals: ["Escalate risk."], do: ["Use tools."], do_not: ["Do not expose secrets."] },
  constraints: { safety: ["Escalate risk."], privacy: ["Protect data."], compliance: ["Follow policy."], escalation: ["Fallback to human_review when unclear."], data_access: ["Use approved data."], evaluation: { all: ["authenticated == true"] } },
  tools: [
    { name: "account_lookup", description: "Reads accounts.", allowed_operations: ["read_account"], forbidden_operations: [], requires_auth: true, risk_level: "medium" },
    { name: "refund_lookup", description: "Reads refunds.", allowed_operations: ["read_refund"], forbidden_operations: [], requires_auth: true, risk_level: "medium" }
  ],
  routes: [
    { name: "billing_support", description: "Billing route.", triggers: ["invoice"], target: "tool:account_lookup", priority: 10 },
    { name: "refund_support", description: "Refund route.", triggers: ["refund"], target: "tool:refund_lookup", priority: 20 },
    { name: "fallback_human_review", description: "Fallback route.", triggers: ["fallback", "unclear"], target: "handoff:human_review", priority: 100 }
  ],
  handoffs: [{ name: "human_review", condition: "Needs review.", destination: "queue:human", required_context: ["summary"] }],
  scenarios: [{ name: "invoice-scenario", input: "invoice help", context: { authenticated: true } }],
  tests: [{ name: "billing route", input: "invoice help", expected_route: "billing_support", expected_handoff: "human_review", expected_tool_calls: ["account_lookup"], forbidden_tool_calls: [], assertions: ["route is billing_support"] }]
};

describe("behavioural coverage analysis", () => {
  it("reports coverage metrics and uncovered branches", () => {
    const report = analyseBehaviouralCoverage(spec);

    expect(report.routeCoverage).toEqual({ total: 3, covered: 1, percentage: 33, uncovered: ["fallback_human_review", "refund_support"] });
    expect(report.handoffCoverage).toEqual({ total: 1, covered: 1, percentage: 100, uncovered: [] });
    expect(report.toolCoverage).toEqual({ total: 2, covered: 1, percentage: 50, uncovered: ["refund_lookup"] });
    expect(report.constraintCoverage.percentage).toBe(17);
    expect(report.fallbackCoverage).toEqual({ total: 1, covered: 0, percentage: 0, uncovered: ["fallback_human_review"] });
    expect(report.testScenarioCoverage).toEqual({ total: 2, covered: 2, percentage: 100, uncovered: [] });
    expect(report.uncoveredBranches).toEqual(expect.arrayContaining(["route:refund_support", "fallback:fallback_human_review", "tool:refund_lookup"]));
  });

  it("recommends deterministic test scenarios for uncovered behaviour", () => {
    const report = analyseBehaviouralCoverage(spec);

    expect(report.recommendedTestScenarios).toEqual(expect.arrayContaining([
      { name: "cover-refund_support", reason: "Add a test or scenario that triggers route refund_support." },
      { name: "cover-fallback_human_review", reason: "Add a fallback test or scenario for fallback_human_review." },
      { name: "cover-refund_lookup", reason: "Add a test expecting tool refund_lookup." }
    ]));
  });
});
