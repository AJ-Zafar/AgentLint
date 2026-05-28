import { describe, expect, it } from "vitest";
import { compileAgentSpecGraph } from "./index";
import type { AgentSpecDocument } from "@agentspec/spec";

const baseSpec: AgentSpecDocument = {
  agent: { name: "Grammar Agent", description: "Tests graph compilation.", version: "1.0.0", owner: "qa", domain: "grammar" },
  persona: { role: "Router", tone: "neutral", verbosity: "concise", style_rules: ["Be clear."] },
  instructions: { primary_goal: "Route requests.", secondary_goals: ["Stay safe."], do: ["Use routes."], do_not: ["Do not invent tools."] },
  constraints: {
    safety: ["Escalate risk."],
    privacy: ["Protect data."],
    compliance: ["Follow policy."],
    escalation: ["Fallback to human_review when unclear."],
    data_access: ["Use approved data."],
    evaluation: { all: ["authenticated == true", "risk != critical"] }
  },
  tools: [{ name: "refund_lookup", description: "Reads refunds.", allowed_operations: ["read_refund"], forbidden_operations: [], requires_auth: true, risk_level: "medium" }],
  routes: [
    {
      name: "small_refund",
      description: "Handles small refunds.",
      triggers: ["refund"],
      target: "tool:refund_lookup",
      priority: 10,
      conditions: { all: ["intent == refund", "authenticated == true", "amount < 50"] }
    },
    {
      name: "fallback_human_review",
      description: "Fallback route.",
      triggers: ["fallback"],
      target: "handoff:human_review",
      priority: 100,
      depends_on: ["small_refund"]
    }
  ],
  handoffs: [{ name: "human_review", condition: "Fallback required.", destination: "queue:human", required_context: ["summary"] }],
  precedence: { routes: ["small_refund", "fallback_human_review"] },
  tests: []
};

describe("formal grammar and behaviour graph compilation", () => {
  it("compiles routes, tools and handoffs into a behaviour graph", () => {
    const result = compileAgentSpecGraph(baseSpec);

    expect(result.diagnostics).toEqual([]);
    expect(result.graph.precedence).toEqual(["small_refund", "fallback_human_review"]);
    expect(result.graph.nodes).toEqual(expect.arrayContaining([
      { id: "start", kind: "start", label: "Start" },
      { id: "route:small_refund", kind: "route", label: "small_refund" },
      { id: "tool:refund_lookup", kind: "tool", label: "refund_lookup" },
      { id: "handoff:human_review", kind: "handoff", label: "human_review" }
    ]));
    expect(result.graph.edges).toEqual(expect.arrayContaining([
      { from: "start", to: "route:small_refund", label: "intent == refund AND authenticated == true AND amount < 50" },
      { from: "route:small_refund", to: "tool:refund_lookup", label: "target" },
      { from: "route:fallback_human_review", to: "handoff:human_review", label: "target" },
      { from: "route:small_refund", to: "route:fallback_human_review", label: "depends_on" }
    ]));
  });

  it("validates invalid condition operators", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      routes: [{ ...baseSpec.routes[0], conditions: { all: ["intent === refund"] } }, baseSpec.routes[1]]
    };

    expect(compileAgentSpecGraph(spec).diagnostics).toEqual([
      expect.objectContaining({ code: "invalid-operator", path: "routes.0.conditions.all.0" })
    ]);
  });

  it("validates circular route dependencies", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      routes: [
        { ...baseSpec.routes[0], depends_on: ["fallback_human_review"] },
        { ...baseSpec.routes[1], depends_on: ["small_refund"] }
      ]
    };

    expect(compileAgentSpecGraph(spec).diagnostics).toEqual([
      expect.objectContaining({ code: "circular-dependency" })
    ]);
  });

  it("validates unreachable branches from contradictory all conditions", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      routes: [{ ...baseSpec.routes[0], conditions: { all: ["intent == refund", "intent != refund"] } }, baseSpec.routes[1]]
    };

    expect(compileAgentSpecGraph(spec).diagnostics).toEqual([
      expect.objectContaining({ code: "unreachable-branch", path: "routes.0.conditions" })
    ]);
  });

  it("validates conflicting precedence definitions", () => {
    const spec: AgentSpecDocument = {
      ...baseSpec,
      precedence: { routes: ["fallback_human_review", "small_refund", "small_refund"] }
    };

    expect(compileAgentSpecGraph(spec).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "conflicting-precedence" })
    ]));
  });
});
