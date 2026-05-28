import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { AgentSpecDocument, AgentSpecRoute, AgentSpecTool } from "@agentspec/spec";

export type ExtractedTopic = {
  name: string;
  triggerPhrases: string[];
  actions: string[];
  knowledgeSources: string[];
  generativeOrchestration?: Record<string, unknown>;
};

export type ExtractedAction = {
  name: string;
  riskLevel?: string;
  requiresAuthentication?: boolean;
  operations: string[];
  flow?: string;
};

export type ExtractedFlow = { name: string; trigger?: string; actions: string[] };
export type ExtractedKnowledgeReference = { name: string; source?: string; description?: string };
export type ExtractedHandoff = { name: string; destination?: string; condition?: string };
export type ExtractedFallback = { name: string; target?: string; triggers: string[] };
export type ExtractedOrchestration = { name: string; enabled?: boolean; mode?: string; knowledgeSources: string[]; fallback?: string };

export type ExtractedCopilotStudioSolution = {
  solutionPath: string;
  botName?: string;
  topics: ExtractedTopic[];
  actions: ExtractedAction[];
  flows: ExtractedFlow[];
  knowledgeReferences: ExtractedKnowledgeReference[];
  handoffs: ExtractedHandoff[];
  fallbacks: ExtractedFallback[];
  generativeOrchestration: ExtractedOrchestration[];
  authenticationAssumptions: string[];
};

export type CopilotStudioAuditReport = {
  experimental: true;
  solutionPath: string;
  extracted: ExtractedCopilotStudioSolution;
  findings: {
    expectedMissingTopics: string[];
    unexpectedTopics: string[];
    expectedMissingActions: string[];
    highRiskToolsNotDocumentedInAgentSpec: ExtractedAction[];
    missingFallbackHandoffCoverage: string[];
    testsReferencingMissingRoutesOrActions: Array<{ testName: string; missingRoutes: string[]; missingActions: string[] }>;
  };
  summary: {
    findingCount: number;
    expectedTopicCount: number;
    extractedTopicCount: number;
    expectedActionCount: number;
    extractedActionCount: number;
  };
};

export type CopilotStudioDriftReport = {
  experimental: true;
  solutionPath: string;
  summary: { driftCount: number; missingTopicCount: number; unexpectedTopicCount: number; missingActionCount: number; undocumentedHighRiskActionCount: number };
  items: Array<{ type: "missing-topic" | "unexpected-topic" | "missing-action" | "undocumented-high-risk-action" | "missing-fallback" | "test-reference-missing"; name: string; detail: string }>;
};

type ParsedSolutionFile = { path: string; json?: Record<string, unknown>; text: string };
const highRiskLevels = new Set(["high", "critical"]);

export async function extractCopilotStudioSolution(solutionPath: string): Promise<ExtractedCopilotStudioSolution> {
  const buffer = await readFile(solutionPath);
  const zip = await JSZip.loadAsync(buffer);
  const files = await Promise.all(Object.values(zip.files).filter((file) => !file.dir).map(async (file): Promise<ParsedSolutionFile> => ({ path: file.name, text: await file.async("string"), json: parseJson(await file.async("string")) })));

  let botName: string | undefined;
  const topics = new Map<string, ExtractedTopic>();
  const actions = new Map<string, ExtractedAction>();
  const flows = new Map<string, ExtractedFlow>();
  const knowledgeReferences = new Map<string, ExtractedKnowledgeReference>();
  const handoffs = new Map<string, ExtractedHandoff>();
  const fallbacks = new Map<string, ExtractedFallback>();
  const generativeOrchestration = new Map<string, ExtractedOrchestration>();
  const authenticationAssumptions = new Set<string>();

  for (const file of files) {
    const json = file.json;
    const kind = stringValue(json?.kind).toLowerCase();
    const path = file.path.toLowerCase();
    const name = stringValue(json?.name) || inferNameFromPath(file.path);

    if (kind === "topic" || path.includes("topic")) {
      topics.set(name, {
        name,
        triggerPhrases: stringArray(json?.triggerPhrases ?? json?.triggers),
        actions: stringArray(json?.actions),
        knowledgeSources: stringArray(json?.knowledgeSources ?? json?.knowledge_sources),
        generativeOrchestration: recordValue(json?.generativeOrchestration ?? json?.generative_orchestration)
      });
      continue;
    }
    if (kind === "action" || path.includes("action")) {
      actions.set(name, {
        name,
        riskLevel: optionalString(json?.riskLevel ?? json?.risk_level),
        requiresAuthentication: optionalBoolean(json?.requiresAuthentication ?? json?.requires_auth),
        operations: stringArray(json?.operations),
        flow: optionalString(json?.flow)
      });
      continue;
    }
    if (kind === "flow" || path.includes("workflow") || path.includes("flow")) {
      flows.set(name, { name, trigger: optionalString(json?.trigger), actions: stringArray(json?.actions) });
      continue;
    }
    if (kind === "knowledge" || path.includes("knowledge")) {
      knowledgeReferences.set(name, { name, source: optionalString(json?.source), description: optionalString(json?.description) });
      continue;
    }
    if (kind === "handoff" || path.includes("handoff")) {
      handoffs.set(name, { name, destination: optionalString(json?.destination), condition: optionalString(json?.condition) });
      continue;
    }
    if (kind === "fallback" || path.includes("fallback")) {
      fallbacks.set(name, { name, target: optionalString(json?.target), triggers: stringArray(json?.triggers) });
      continue;
    }
    if (kind === "orchestration" || path.includes("orchestration")) {
      generativeOrchestration.set(name, { name, enabled: optionalBoolean(json?.enabled), mode: optionalString(json?.mode), knowledgeSources: stringArray(json?.knowledgeSources), fallback: optionalString(json?.fallback) });
      continue;
    }
    if (kind === "authentication" || path.includes("auth")) {
      for (const assumption of stringArray(json?.assumptions)) authenticationAssumptions.add(assumption);
      continue;
    }
    if (kind === "" && path.endsWith("bot.json")) botName = optionalString(json?.name);
  }

  return {
    solutionPath,
    botName,
    topics: sortByName([...topics.values()]),
    actions: sortByName([...actions.values()]),
    flows: sortByName([...flows.values()]),
    knowledgeReferences: sortByName([...knowledgeReferences.values()]),
    handoffs: sortByName([...handoffs.values()]),
    fallbacks: sortByName([...fallbacks.values()]),
    generativeOrchestration: sortByName([...generativeOrchestration.values()]),
    authenticationAssumptions: [...authenticationAssumptions].sort()
  };
}

export async function auditCopilotStudioSolution(options: { spec: AgentSpecDocument; solutionPath: string }): Promise<CopilotStudioAuditReport> {
  const extracted = await extractCopilotStudioSolution(options.solutionPath);
  const findings = compareExtractedSolution(options.spec, extracted);
  const findingCount = findings.expectedMissingTopics.length + findings.unexpectedTopics.length + findings.expectedMissingActions.length + findings.highRiskToolsNotDocumentedInAgentSpec.length + findings.missingFallbackHandoffCoverage.length + findings.testsReferencingMissingRoutesOrActions.length;
  return { experimental: true, solutionPath: options.solutionPath, extracted, findings, summary: { findingCount, expectedTopicCount: options.spec.routes.length, extractedTopicCount: extracted.topics.length, expectedActionCount: options.spec.tools.length, extractedActionCount: extracted.actions.length } };
}

export async function generateAgentSpecFromCopilotStudioSolution(solutionPath: string): Promise<AgentSpecDocument> {
  const extracted = await extractCopilotStudioSolution(solutionPath);
  const tools: AgentSpecTool[] = extracted.actions.map((action) => ({ name: action.name, description: `Extracted Copilot Studio action ${action.name}.`, allowed_operations: action.operations.length ? action.operations : [`invoke_${action.name}`], forbidden_operations: [], requires_auth: action.requiresAuthentication ?? true, risk_level: toRiskLevel(action.riskLevel) }));
  const routes: AgentSpecRoute[] = [
    ...extracted.topics.map((topic, index) => ({ name: topic.name, description: `Extracted Copilot Studio topic ${topic.name}.`, triggers: topic.triggerPhrases.length ? topic.triggerPhrases : [topic.name], target: topic.actions[0] ? `tool:${topic.actions[0]}` : `handoff:${extracted.handoffs[0]?.name ?? "human_review"}`, priority: (index + 1) * 10 })),
    ...extracted.fallbacks.map((fallback, index) => ({ name: fallback.name, description: `Extracted Copilot Studio fallback ${fallback.name}.`, triggers: fallback.triggers.length ? fallback.triggers : ["fallback"], target: fallback.target ?? `handoff:${extracted.handoffs[0]?.name ?? "human_review"}`, priority: 100 + index }))
  ];
  return {
    agent: { name: extracted.botName ?? "Extracted Copilot Studio Agent", description: "Generated from a local Copilot Studio solution export.", version: "0.1.0", owner: "unassigned", domain: "copilot-studio" },
    persona: { role: "Extracted Copilot Studio agent", tone: "professional", verbosity: "concise", style_rules: ["Review generated content before implementation."] },
    instructions: { primary_goal: "Review and govern the extracted Copilot Studio agent behaviour.", secondary_goals: ["Validate extracted topics, actions and handoffs."], do: ["Review extracted solution components before publishing."], do_not: ["Do not treat generated output as an official Microsoft export package."] },
    constraints: { safety: ["Escalate unclear or risky behaviour for human review."], privacy: ["Review extracted knowledge and authentication assumptions before use."], compliance: ["Validate generated spec against organisational governance policy."], escalation: extracted.handoffs.map((handoff) => handoff.condition ?? `Fallback to ${handoff.name} when escalation is required.`), data_access: extracted.knowledgeReferences.map((ref) => `Knowledge source: ${ref.name}${ref.source ? ` (${ref.source})` : ""}`) },
    tools,
    routes,
    handoffs: extracted.handoffs.map((handoff) => ({ name: handoff.name, condition: handoff.condition ?? `Escalate to ${handoff.name}.`, destination: handoff.destination ?? `queue:${handoff.name}`, required_context: ["conversation_summary", "matched_topic"] })),
    tests: []
  };
}

export async function analyseCopilotStudioDrift(options: { spec: AgentSpecDocument; solutionPath: string }): Promise<CopilotStudioDriftReport> {
  const audit = await auditCopilotStudioSolution(options);
  const items: CopilotStudioDriftReport["items"] = [
    ...audit.findings.expectedMissingTopics.map((name) => ({ type: "missing-topic" as const, name, detail: `Expected topic ${name} was not found in the solution export.` })),
    ...audit.findings.unexpectedTopics.map((name) => ({ type: "unexpected-topic" as const, name, detail: `Solution export contains topic ${name} not documented in AgentSpec.` })),
    ...audit.findings.expectedMissingActions.map((name) => ({ type: "missing-action" as const, name, detail: `Expected action/tool ${name} was not found in the solution export.` })),
    ...audit.findings.highRiskToolsNotDocumentedInAgentSpec.map((action) => ({ type: "undocumented-high-risk-action" as const, name: action.name, detail: `High-risk action ${action.name} is present in the export but not documented in AgentSpec.` })),
    ...audit.findings.missingFallbackHandoffCoverage.map((name) => ({ type: "missing-fallback" as const, name, detail: `Expected fallback or handoff coverage ${name} was not found.` })),
    ...audit.findings.testsReferencingMissingRoutesOrActions.map((test) => ({ type: "test-reference-missing" as const, name: test.testName, detail: `Test references missing routes/actions: ${[...test.missingRoutes, ...test.missingActions].join(", ")}.` }))
  ];
  return { experimental: true, solutionPath: options.solutionPath, summary: { driftCount: items.length, missingTopicCount: audit.findings.expectedMissingTopics.length, unexpectedTopicCount: audit.findings.unexpectedTopics.length, missingActionCount: audit.findings.expectedMissingActions.length, undocumentedHighRiskActionCount: audit.findings.highRiskToolsNotDocumentedInAgentSpec.length }, items };
}

function compareExtractedSolution(spec: AgentSpecDocument, extracted: ExtractedCopilotStudioSolution): CopilotStudioAuditReport["findings"] {
  const expectedTopics = spec.routes.map((route) => route.name).sort();
  const extractedTopics = new Set([...extracted.topics.map((topic) => topic.name), ...extracted.fallbacks.map((fallback) => fallback.name)]);
  const expectedActions = spec.tools.map((tool) => tool.name).sort();
  const extractedActions = new Set(extracted.actions.map((action) => action.name));
  const expectedHandoffs = spec.handoffs.map((handoff) => handoff.name).sort();
  const extractedHandoffs = new Set(extracted.handoffs.map((handoff) => handoff.name));
  const specToolNames = new Set(expectedActions);
  const expectedMissingTopics = expectedTopics.filter((topic) => !extractedTopics.has(topic));
  const unexpectedTopics = extracted.topics.map((topic) => topic.name).filter((topic) => !expectedTopics.includes(topic));
  const expectedMissingActions = expectedActions.filter((action) => !extractedActions.has(action));
  const highRiskToolsNotDocumentedInAgentSpec = extracted.actions.filter((action) => action.riskLevel && highRiskLevels.has(action.riskLevel.toLowerCase()) && !specToolNames.has(action.name));
  const missingFallbackHandoffCoverage = expectedHandoffs.filter((handoff) => !extractedHandoffs.has(handoff));
  const testsReferencingMissingRoutesOrActions = (spec.tests ?? []).map((test) => ({ testName: test.name, missingRoutes: test.expected_route && !extractedTopics.has(test.expected_route) ? [test.expected_route] : [], missingActions: test.expected_tool_calls.filter((tool) => !extractedActions.has(tool)) })).filter((item) => item.missingRoutes.length > 0 || item.missingActions.length > 0);
  return { expectedMissingTopics, unexpectedTopics, expectedMissingActions, highRiskToolsNotDocumentedInAgentSpec, missingFallbackHandoffCoverage: [...new Set(missingFallbackHandoffCoverage)].sort(), testsReferencingMissingRoutesOrActions };
}

function parseJson(text: string): Record<string, unknown> | undefined { try { const parsed = JSON.parse(text); return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined; } catch { return undefined; } }
function recordValue(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function optionalBoolean(value: unknown): boolean | undefined { return typeof value === "boolean" ? value : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : []; }
function inferNameFromPath(path: string): string { const file = path.split("/").pop() ?? path; return file.replace(/\.[^.]+$/, ""); }
function sortByName<T extends { name: string }>(items: T[]): T[] { return items.sort((left, right) => left.name.localeCompare(right.name)); }
function toRiskLevel(value: string | undefined): AgentSpecTool["risk_level"] { return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium"; }
