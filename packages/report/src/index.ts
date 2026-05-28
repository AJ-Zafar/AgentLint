import type { AgentSpecDocument } from "@agentspec/spec";
import { lintAgentSpec, type PolicyPackName } from "@agentspec/linter";
import { analyseBehaviouralCoverage } from "@agentspec/coverage";
import { replayScenario } from "@agentspec/replay";

export type GovernanceReportOptions = {
  policyPacks?: string[];
};

export function generateGovernanceMarkdownReport(spec: AgentSpecDocument, options: GovernanceReportOptions = {}): string {
  const policyPacks = (options.policyPacks ?? []) as PolicyPackName[];
  const lint = lintAgentSpec(spec, { policyPacks });
  const coverage = analyseBehaviouralCoverage(spec);
  const replayResults = (spec.scenarios ?? []).map((scenario) => replayScenario(spec, scenario.name));
  const highRiskTools = spec.tools.filter((tool) => tool.risk_level === "high" || tool.risk_level === "critical");
  const authGaps = spec.tools.filter((tool) => (tool.risk_level === "high" || tool.risk_level === "critical") && !tool.requires_auth);
  const fallbackRoutes = spec.routes.filter((route) => /fallback|unclear|policy gap/i.test(`${route.name} ${route.description} ${route.triggers.join(" ")}`));
  const handoffRoutes = spec.routes.filter((route) => route.target.startsWith("handoff:"));

  const lines = [
    "# Governance Evidence Report",
    "",
    "This report is generated locally from an Agent Lint specification. It is intended to support architecture review boards and enterprise governance sign-off. It does not guarantee deterministic AI behaviour.",
    "",
    "## 1. Agent summary",
    "",
    `- Name: ${spec.agent.name}`,
    `- Description: ${spec.agent.description}`,
    `- Owner: ${spec.agent.owner}`,
    `- Domain: ${spec.agent.domain}`,
    `- Version: ${spec.agent.version}`,
    `- Primary goal: ${spec.instructions.primary_goal}`,
    "",
    "## 2. Lint findings",
    "",
    `- Total findings: ${lint.issues.length}`,
    ...listOrNone(lint.issues.map((issue) => `${issue.severity} ${issue.ruleId} at ${issue.path}: ${issue.message}`)),
    "",
    "## 3. Behavioural coverage",
    "",
    `- Coverage overall: ${coverage.overall}%`,
    `- Route coverage: ${coverage.routeCoverage.percentage}% (${coverage.routeCoverage.covered}/${coverage.routeCoverage.total})`,
    `- Handoff coverage: ${coverage.handoffCoverage.percentage}% (${coverage.handoffCoverage.covered}/${coverage.handoffCoverage.total})`,
    `- Tool coverage: ${coverage.toolCoverage.percentage}% (${coverage.toolCoverage.covered}/${coverage.toolCoverage.total})`,
    `- Constraint coverage: ${coverage.constraintCoverage.percentage}% (${coverage.constraintCoverage.covered}/${coverage.constraintCoverage.total})`,
    `- Fallback coverage: ${coverage.fallbackCoverage.percentage}% (${coverage.fallbackCoverage.covered}/${coverage.fallbackCoverage.total})`,
    "",
    "## 4. Scenario replay results",
    "",
    ...listOrNone(replayResults.map((result) => `Replay scenario: ${result.scenario}; selected route: ${result.selectedRoute ?? "none"}; path: ${result.decisionPath.join(" -> ")}`)),
    "",
    "## 5. Risk analysis",
    "",
    `- High-risk tools: ${highRiskTools.length}`,
    ...listOrNone(highRiskTools.map((tool) => `${tool.name}: ${tool.risk_level}`)),
    `- Authentication gaps: ${authGaps.length}`,
    ...listOrNone(authGaps.map((tool) => `${tool.name} is ${tool.risk_level} but does not require authentication.`)),
    "",
    "## 6. Escalation assurance",
    "",
    `- Handoffs defined: ${spec.handoffs.length}`,
    `- Routes targeting handoffs: ${handoffRoutes.length}`,
    `- Fallback routes: ${fallbackRoutes.length}`,
    ...listOrNone(spec.handoffs.map((handoff) => `${handoff.name}: ${handoff.condition} -> ${handoff.destination}`)),
    "",
    "## 7. Tool access controls",
    "",
    ...listOrNone(spec.tools.map((tool) => `${tool.name}: auth=${tool.requires_auth}; risk=${tool.risk_level ?? "unspecified"}; allowed=${tool.allowed_operations.join(", ")}; forbidden=${tool.forbidden_operations.join(", ") || "none"}`)),
    "",
    "## 8. Policy compliance checks",
    "",
    `- Policy packs applied: ${policyPacks.length ? policyPacks.join(", ") : "none"}`,
    ...listOrNone(lint.issues.filter((issue) => String(issue.ruleId).startsWith("policy-")).map((issue) => `${issue.ruleId}: ${issue.message}`)),
    ""
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}
