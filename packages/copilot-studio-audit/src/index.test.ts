import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import {
  auditCopilotStudioSolution,
  extractCopilotStudioSolution,
  generateAgentSpecFromCopilotStudioSolution,
  analyseCopilotStudioDrift
} from "./index";

const solutionPath = "packages/copilot-studio-audit/fixtures/fake-solution.zip";
const specPath = "examples/copilot-studio-agent.agentspec.yaml";

describe("Copilot Studio solution audit", () => {
  it("deeply extracts Copilot Studio solution components from a local zip", async () => {
    const extracted = await extractCopilotStudioSolution(solutionPath);

    expect(extracted.topics).toEqual([
      {
        name: "deployment_readiness",
        triggerPhrases: ["deployment", "environment", "publish", "readiness"],
        actions: ["inspect_agent_config"],
        knowledgeSources: ["publishing_policy"],
        generativeOrchestration: { enabled: true, mode: "generative", fallbackTopic: "fallback_maker_admin_review" }
      },
      {
        name: "unexpected_marketing_topic",
        triggerPhrases: ["campaign", "marketing"],
        actions: ["delete_environment"],
        knowledgeSources: [],
        generativeOrchestration: { enabled: false }
      }
    ]);
    expect(extracted.actions).toEqual([
      { name: "delete_environment", riskLevel: "critical", requiresAuthentication: true, operations: ["delete_environment"], flow: undefined },
      { name: "inspect_agent_config", riskLevel: "high", requiresAuthentication: true, operations: ["read_connectors", "read_environment_policy", "read_publish_status", "read_topics"], flow: "inspect_agent_config_flow" }
    ]);
    expect(extracted.flows).toEqual([{ name: "inspect_agent_config_flow", trigger: "manual", actions: ["read_connectors", "read_environment_policy", "read_publish_status", "read_topics"] }]);
    expect(extracted.knowledgeReferences).toEqual([{ name: "publishing_policy", source: "policy://publishing", description: "Publishing and DLP policy reference" }]);
    expect(extracted.handoffs).toEqual([{ name: "maker_admin_review", destination: "queue:maker-admin-review", condition: "Publishing or connector risk requires administrator review." }]);
    expect(extracted.fallbacks).toEqual([{ name: "fallback_maker_admin_review", target: "handoff:maker_admin_review", triggers: ["fallback", "policy gap", "unclear"] }]);
    expect(extracted.authenticationAssumptions).toEqual(["Connector inventory requires authenticated Power Platform access", "Maker must have environment read access"]);
    expect(extracted.generativeOrchestration).toEqual([{ name: "generative_orchestration", enabled: true, mode: "generative", knowledgeSources: ["publishing_policy"], fallback: "fallback_maker_admin_review" }]);
  });

  it("compares extracted components against AgentSpec expectations", async () => {
    const parsed = await parseAgentSpecFile(specPath);
    const report = await auditCopilotStudioSolution({ spec: parsed.document, solutionPath });

    expect(report.findings).toMatchObject({
      expectedMissingTopics: ["connector_review"],
      unexpectedTopics: ["unexpected_marketing_topic"],
      expectedMissingActions: [],
      highRiskToolsNotDocumentedInAgentSpec: [{ name: "delete_environment", riskLevel: "critical", requiresAuthentication: true, operations: ["delete_environment"], flow: undefined }],
      missingFallbackHandoffCoverage: [],
      testsReferencingMissingRoutesOrActions: []
    });
    expect(report.summary.findingCount).toBe(3);
  });

  it("generates an Agent Lint spec from extracted Copilot Studio components", async () => {
    const generated = await generateAgentSpecFromCopilotStudioSolution(solutionPath);

    expect(generated.agent.name).toBe("Copilot Studio Readiness Agent");
    expect(generated.routes.map((route) => route.name)).toEqual(["deployment_readiness", "unexpected_marketing_topic", "fallback_maker_admin_review"]);
    expect(generated.tools.map((tool) => tool.name)).toEqual(["delete_environment", "inspect_agent_config"]);
    expect(generated.handoffs[0]).toMatchObject({ name: "maker_admin_review", destination: "queue:maker-admin-review" });
    expect(generated.constraints.data_access).toEqual(expect.arrayContaining(["Knowledge source: publishing_policy (policy://publishing)"]));
  });

  it("produces drift analysis between AgentSpec and solution extraction", async () => {
    const parsed = await parseAgentSpecFile(specPath);
    const drift = await analyseCopilotStudioDrift({ spec: parsed.document, solutionPath });

    expect(drift.summary.driftCount).toBe(3);
    expect(drift.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "missing-topic", name: "connector_review" }),
      expect.objectContaining({ type: "unexpected-topic", name: "unexpected_marketing_topic" }),
      expect.objectContaining({ type: "undocumented-high-risk-action", name: "delete_environment" })
    ]));
  });
});
