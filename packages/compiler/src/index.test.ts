import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseAgentSpecYaml } from "@agentspec/parser";
import { compileInstructionsToAgentSpec } from "./index";

const fixturePath = "packages/compiler/fixtures/support-instructions.md";

describe("natural language compiler", () => {
  it("extracts goals, rules, constraints, tools, routes and escalation heuristically", async () => {
    const input = await readFile(fixturePath, "utf8");
    const result = compileInstructionsToAgentSpec(input);

    expect(result.document.instructions.primary_goal).toBe("Help customers with refund and invoice questions using policy-approved routes.");
    expect(result.document.instructions.do).toContain("Confirm the customer is authenticated before discussing account details.");
    expect(result.document.instructions.do_not).toContain("Never request full payment card numbers or passwords.");
    expect(result.document.tools[0]).toMatchObject({ name: "account_lookup", requires_auth: true, risk_level: "medium" });
    expect(result.document.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "refund_support", conditions: { all: ["intent == refund", "authenticated == true", "amount < 50"] } }),
      expect.objectContaining({ name: "fallback_human_support", target: "handoff:human_support" })
    ]));
    expect(result.document.handoffs[0]).toMatchObject({ name: "human_support" });
  });

  it("adds confidence metadata and ambiguity warnings", async () => {
    const input = await readFile(fixturePath, "utf8");
    const result = compileInstructionsToAgentSpec(input);

    expect(result.document.compiler).toMatchObject({
      generated_by: "agentlint-natural-language-compiler",
      status: "experimental"
    });
    expect(result.document.compiler?.confidence["instructions.primary_goal"]).toBeGreaterThan(0.7);
    expect(result.document.compiler?.confidence["routes.refund_support.conditions"]).toBeGreaterThan(0.7);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Ambiguous language") ]));
  });

  it("emits parseable Agent Lint YAML", async () => {
    const input = await readFile(fixturePath, "utf8");
    const result = compileInstructionsToAgentSpec(input);
    const parsed = parseAgentSpecYaml(result.yaml);

    expect(parsed.document.agent.name).toBe("Refund support agent");
    expect(parsed.document.compiler?.warnings).toEqual(result.warnings);
  });
});
