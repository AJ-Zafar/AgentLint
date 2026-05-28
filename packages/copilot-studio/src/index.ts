import type { AgentSpecDocument, AgentSpecRoute, AgentSpecTool } from "@agentspec/spec";

export function convertAgentSpecToCopilotStudioPlan(spec: AgentSpecDocument): string {
  const lines: string[] = [
    `# Copilot Studio Implementation Plan: ${spec.agent.name}`,
    "",
    "> Experimental planning output only. No Microsoft APIs are called, and this does not generate a Copilot Studio export package.",
    "",
    "## Agent Summary",
    "",
    `- Domain: ${spec.agent.domain}`,
    `- Owner: ${spec.agent.owner}`,
    `- Version: ${spec.agent.version}`,
    `- Primary goal: ${spec.instructions.primary_goal}`,
    `- Persona: ${spec.persona.role} (${spec.persona.tone}, ${spec.persona.verbosity})`,
    "",
    "## Topics",
    ""
  ];

  for (const route of spec.routes) {
    lines.push(...topicLines(route), "");
  }

  lines.push("## Actions", "");
  for (const tool of spec.tools) {
    lines.push(...actionLines(tool), "");
  }

  lines.push("## Knowledge Sources", "");
  for (const source of knowledgeSources(spec)) {
    lines.push(`- ${source}`);
  }

  lines.push("", "## Handoff Rules", "");
  for (const handoff of spec.handoffs) {
    lines.push(`### ${handoff.name}`);
    lines.push(`- Condition: ${handoff.condition}`);
    lines.push(`- Destination: ${handoff.destination}`);
    lines.push(`- Required context: ${formatList(handoff.required_context)}`);
    lines.push("");
  }

  lines.push("## Authentication Assumptions", "");
  const authLines = authenticationAssumptions(spec.tools);
  for (const line of authLines) {
    lines.push(`- ${line}`);
  }

  lines.push("", "## Power Automate Flows", "");
  for (const flow of powerAutomateFlows(spec.tools)) {
    lines.push(`### ${flow.name}`);
    lines.push(`- Purpose: Support the AgentSpec tool \`${flow.toolName}\`.`);
    lines.push(`- Operations: ${formatList(flow.operations)}`);
    lines.push(`- Risk level: ${flow.riskLevel}`);
    lines.push("- Implementation note: create a draft Power Automate flow manually; this package does not call Microsoft APIs.");
    lines.push("");
  }

  lines.push("## Implementation Notes", "");
  lines.push("- Review topic trigger phrases before creating Copilot Studio topics.");
  lines.push("- Model each AgentSpec tool as a candidate action or Power Automate-backed action.");
  lines.push("- Treat handoff destinations as planning placeholders until environment-specific queues are confirmed.");
  lines.push("- Validate authentication and DLP assumptions with the tenant administrator before implementation.");

  return `${lines.join("\n").trimEnd()}\n`;
}

function topicLines(route: AgentSpecRoute): string[] {
  return [
    `### ${route.name}`,
    `- Description: ${route.description}`,
    `- Triggers: ${formatList(route.triggers)}`,
    `- Target mapping: ${route.target}`,
    `- Priority: ${route.priority}`,
    `- Copilot Studio concept: Topic with trigger phrases and a node that invokes ${targetDescription(route.target)}.`
  ];
}

function actionLines(tool: AgentSpecTool): string[] {
  return [
    `### ${tool.name}`,
    `- Description: ${tool.description}`,
    `- Allowed operations: ${formatList(tool.allowed_operations)}`,
    `- Forbidden operations: ${formatList(tool.forbidden_operations)}`,
    `- Requires authentication: ${tool.requires_auth ? "yes" : "no"}`,
    `- Risk level: ${tool.risk_level ?? "unspecified"}`,
    "- Copilot Studio concept: Candidate action; use a connector or Power Automate flow after manual review."
  ];
}

function knowledgeSources(spec: AgentSpecDocument): string[] {
  const sources = new Set<string>();

  for (const item of spec.constraints.compliance) {
    sources.add(item);
  }
  for (const item of spec.constraints.data_access) {
    sources.add(item);
  }
  for (const tool of spec.tools) {
    sources.add(tool.description);
  }

  return [...sources];
}

function authenticationAssumptions(tools: AgentSpecTool[]): string[] {
  const assumptions = tools.map((tool) =>
    tool.requires_auth
      ? `${tool.name} requires authenticated access before it can be implemented as an action.`
      : `${tool.name} does not declare authentication, but tenant policy should still be reviewed.`
  );

  return assumptions.length > 0 ? assumptions : ["No tools declared; no action authentication assumptions identified."];
}

function powerAutomateFlows(tools: AgentSpecTool[]): Array<{ name: string; toolName: string; operations: string[]; riskLevel: string }> {
  return tools.map((tool) => ({
    name: `${tool.name}_flow`,
    toolName: tool.name,
    operations: tool.allowed_operations,
    riskLevel: tool.risk_level ?? "unspecified"
  }));
}

function targetDescription(target: string): string {
  const [kind, name] = target.split(":");
  if (kind === "tool" && name) {
    return `the ${name} action`;
  }
  if (kind === "handoff" && name) {
    return `handoff rule ${name}`;
  }
  return "a manually reviewed implementation step";
}

function formatList(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}
