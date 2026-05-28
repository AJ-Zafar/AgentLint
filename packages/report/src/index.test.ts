import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { generateGovernanceMarkdownReport } from "./index";

const specPath = "packages/replay/fixtures/angry-refund-user.agentspec.yaml";

describe("governance evidence report", () => {
  it("generates architecture review board sections", async () => {
    const parsed = await parseAgentSpecFile(specPath);
    const report = generateGovernanceMarkdownReport(parsed.document, { policyPacks: ["internal-enterprise"] });

    expect(report).toContain("# Governance Evidence Report");
    expect(report).toContain("## 1. Agent summary");
    expect(report).toContain("## 2. Lint findings");
    expect(report).toContain("## 3. Behavioural coverage");
    expect(report).toContain("## 4. Scenario replay results");
    expect(report).toContain("## 5. Risk analysis");
    expect(report).toContain("## 6. Escalation assurance");
    expect(report).toContain("## 7. Tool access controls");
    expect(report).toContain("## 8. Policy compliance checks");
    expect(report).toContain("Replay scenario: angry-refund-user");
    expect(report).toContain("Coverage overall:");
  });
});
