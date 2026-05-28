import { describe, expect, it } from "vitest";
import type { AgentSpecDocument } from "@agentspec/spec";
import { replayScenario } from "./index";

const spec: AgentSpecDocument = {
  agent: { name: "Replay Agent", description: "Replay tests.", version: "1.0.0", owner: "qa", domain: "support" },
  persona: { role: "Support", tone: "calm", verbosity: "concise", style_rules: ["Be clear."] },
  instructions: { primary_goal: "Route refund requests.", secondary_goals: ["Escalate angry users."], do: ["Use tools."], do_not: ["Do not approve refunds over 50."] },
  constraints: {
    safety: ["Escalate angry or abusive users to human_support."],
    privacy: ["Do not expose secrets."],
    compliance: ["Follow refund policy."],
    escalation: ["Fallback to human_support when sentiment is angry or amount is 50 or more."],
    data_access: ["Only use account lookup data."],
    evaluation: { all: ["authenticated == true"] }
  },
  tools: [{ name: "account_lookup", description: "Reads account status.", allowed_operations: ["read_account"], forbidden_operations: [], requires_auth: true, risk_level: "medium" }],
  routes: [
    { name: "small_refund", description: "Small refund route.", triggers: ["refund"], target: "tool:account_lookup", priority: 10, conditions: { all: ["intent == refund", "authenticated == true", "amount < 50"] } },
    { name: "fallback_human_support", description: "Fallback for angry or high-value refund users.", triggers: ["angry", "refund", "fallback"], target: "handoff:human_support", priority: 100, conditions: { any: ["sentiment == angry", "amount >= 50"] } }
  ],
  handoffs: [{ name: "human_support", condition: "Angry user or high-value refund requires human review.", destination: "queue:human-support", required_context: ["summary", "amount", "sentiment"] }],
  scenarios: [
    { name: "angry-refund-user", input: "I am angry and want a refund of 75", context: { intent: "refund", authenticated: true, amount: 75, sentiment: "angry" } }
  ],
  tests: []
};

describe("scenario replay engine", () => {
  it("runs deterministic path evaluation through the behaviour graph", () => {
    const result = replayScenario(spec, "angry-refund-user");

    expect(result).toMatchObject({
      scenario: "angry-refund-user",
      selectedRoute: "fallback_human_support",
      decisionPath: ["constraint:evaluation", "decision:small_refund", "decision:fallback_human_support", "route:fallback_human_support", "handoff:human_support", "terminal:fallback_human_support"],
      triggeredConstraints: ["authenticated == true", "intent == refund", "sentiment == angry", "amount >= 50"],
      handoffReasoning: "Route fallback_human_support targets handoff human_support because sentiment == angry OR amount >= 50."
    });
    expect(result.toolEligibilityChecks).toEqual([{ tool: "account_lookup", eligible: false, reason: "Selected route does not invoke this tool." }]);
    expect(result.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "decision", node: "decision:fallback_human_support", result: "matched" }),
      expect.objectContaining({ kind: "handoff", node: "handoff:human_support" })
    ]));
  });
});
