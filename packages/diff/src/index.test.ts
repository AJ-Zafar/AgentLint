import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { diffAgentSpecs, simulateAgentSpecDiff, type BehavioralChangeType } from "./index";

const oldFixture = "packages/diff/fixtures/old.agentspec.yaml";
const newFixture = "packages/diff/fixtures/new.agentspec.yaml";

async function fixtureDiff() {
  const [oldSpec, newSpec] = await Promise.all([parseAgentSpecFile(oldFixture), parseAgentSpecFile(newFixture)]);
  return diffAgentSpecs(oldSpec.document, newSpec.document);
}

const changeTypes = (types: BehavioralChangeType[]) => expect.arrayContaining(types.map((type) => expect.objectContaining({ type })));

describe("AgentSpec behavioral diff", () => {
  it("detects requested behavioral change categories", async () => {
    const result = await fixtureDiff();

    expect(result.changes).toEqual(
      changeTypes([
        "changed-primary-goal",
        "changed-do-instructions",
        "changed-do-not-instructions",
        "added-tool",
        "removed-tool",
        "increased-tool-risk",
        "changed-route-triggers",
        "removed-fallback",
        "changed-escalation-conditions",
        "changed-handoff-destination",
        "changed-tests"
      ])
    );
  });

  it("classifies changes by behavioral impact", async () => {
    const result = await fixtureDiff();

    expect(result.impact).toBe("breaking");
    expect(result.summary).toMatchObject({ total: 11, low: 1, medium: 3, high: 4, breaking: 3 });
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "removed-tool", impact: "breaking" }),
        expect.objectContaining({ type: "removed-fallback", impact: "breaking" }),
        expect.objectContaining({ type: "changed-primary-goal", impact: "high" }),
        expect.objectContaining({ type: "added-tool", impact: "medium" }),
        expect.objectContaining({ type: "changed-tests", impact: "low" })
      ])
    );
  });

  it("includes path, message, before, and after for each change", async () => {
    const result = await fixtureDiff();
    const primaryGoal = result.changes.find((change) => change.type === "changed-primary-goal");

    expect(primaryGoal).toMatchObject({
      path: "instructions.primary_goal",
      before: "Route support requests using approved paths.",
      after: "Resolve support requests automatically when confidence is high."
    });
    expect(primaryGoal?.message).toContain("Primary goal changed");
  });

  it("returns no changes for identical specs", async () => {
    const parsed = await parseAgentSpecFile(oldFixture);
    const result = diffAgentSpecs(parsed.document, parsed.document);

    expect(result).toEqual({
      impact: "low",
      changes: [],
      summary: { total: 0, low: 0, medium: 0, high: 0, breaking: 0 }
    });
  });
});


describe("AgentSpec simulated behavioural diff", () => {
  it("analyses deterministic scenario behaviour changes", async () => {
    const [oldSpec, newSpec] = await Promise.all([parseAgentSpecFile(oldFixture), parseAgentSpecFile(newFixture)]);
    const report = simulateAgentSpecDiff(oldSpec.document, newSpec.document);

    expect(report.impact).toBe("breaking");
    expect(report.summary.totalScenarios).toBeGreaterThan(0);
    expect(report.routeSelectionChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: "fallback_human_support", beforeProbability: expect.any(Number), afterProbability: expect.any(Number) })
      ])
    );
    expect(report.escalationFrequencyChange.before).toBeGreaterThan(report.escalationFrequencyChange.after);
    expect(report.toolEligibilityChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "customer_email", beforeEligible: false, afterEligible: true })
      ])
    );
    expect(report.fallbackInvocationChange.before).toBeGreaterThan(report.fallbackInvocationChange.after);
    expect(report.constraintPrecedenceChanges).toEqual(expect.arrayContaining(["constraints.escalation changed"]));
    expect(report.impactedRoutes).toEqual(expect.arrayContaining(["billing_support", "fallback_human_support"]));
    expect(report.changedPaths).toContain("instructions.primary_goal");
    expect(report.newlyUnreachableStates).toEqual(expect.arrayContaining(["tool:refund_approval"]));
    expect(report.likelyRegressionAreas).toEqual(expect.arrayContaining(["fallback coverage", "tool eligibility", "escalation behaviour"]));
  });

  it("returns low impact for identical specs", async () => {
    const parsed = await parseAgentSpecFile(oldFixture);
    const report = simulateAgentSpecDiff(parsed.document, parsed.document);

    expect(report.impact).toBe("low");
    expect(report.summary.changedScenarioCount).toBe(0);
    expect(report.likelyRegressionAreas).toEqual([]);
  });
});
