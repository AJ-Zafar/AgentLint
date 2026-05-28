import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { diffAgentSpecs, type BehavioralChangeType } from "./index";

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
