import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { auditCopilotStudioSolution } from "./index";

const solutionPath = "packages/copilot-studio-audit/fixtures/fake-solution.zip";
const specPath = "examples/copilot-studio-agent.agentspec.yaml";

describe("Copilot Studio solution audit", () => {
  it("extracts likely Copilot Studio components from a local solution zip", async () => {
    const parsed = await parseAgentSpecFile(specPath);
    const report = await auditCopilotStudioSolution({ spec: parsed.document, solutionPath });

    expect(report.experimental).toBe(true);
    expect(report.extracted.topics).toEqual(["deployment_readiness", "unexpected_marketing_topic"]);
    expect(report.extracted.actions).toEqual([
      { name: "delete_environment", riskLevel: "critical" },
      { name: "inspect_agent_config", riskLevel: "high" }
    ]);
    expect(report.extracted.flows).toEqual(["inspect_agent_config_flow"]);
    expect(report.extracted.knowledgeReferences).toEqual(["publishing_policy"]);
    expect(report.extracted.handoffs).toEqual(["maker_admin_review"]);
  });

  it("compares extracted components against AgentSpec expectations", async () => {
    const parsed = await parseAgentSpecFile(specPath);
    const report = await auditCopilotStudioSolution({ spec: parsed.document, solutionPath });

    expect(report.findings).toEqual({
      expectedMissingTopics: ["connector_review", "fallback_maker_admin_review"],
      unexpectedTopics: ["unexpected_marketing_topic"],
      expectedMissingActions: [],
      highRiskToolsNotDocumentedInAgentSpec: [{ name: "delete_environment", riskLevel: "critical" }],
      missingFallbackHandoffCoverage: ["fallback_maker_admin_review"],
      testsReferencingMissingRoutesOrActions: []
    });
    expect(report.summary).toEqual({
      findingCount: 5,
      expectedTopicCount: 3,
      extractedTopicCount: 2,
      expectedActionCount: 1,
      extractedActionCount: 2
    });
  });
});
