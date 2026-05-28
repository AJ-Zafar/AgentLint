import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { AgentSpecDocument } from "@agentspec/spec";

export type CopilotStudioAuditReport = {
  experimental: true;
  solutionPath: string;
  extracted: {
    topics: string[];
    actions: Array<{ name: string; riskLevel?: string }>;
    flows: string[];
    knowledgeReferences: string[];
    handoffs: string[];
  };
  findings: {
    expectedMissingTopics: string[];
    unexpectedTopics: string[];
    expectedMissingActions: string[];
    highRiskToolsNotDocumentedInAgentSpec: Array<{ name: string; riskLevel?: string }>;
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

type ExtractedSolution = CopilotStudioAuditReport["extracted"];

type ParsedSolutionFile = {
  path: string;
  json?: Record<string, unknown>;
  text: string;
};

const highRiskLevels = new Set(["high", "critical"]);

export async function auditCopilotStudioSolution(options: {
  spec: AgentSpecDocument;
  solutionPath: string;
}): Promise<CopilotStudioAuditReport> {
  const extracted = await extractSolution(options.solutionPath);
  const findings = compareExtractedSolution(options.spec, extracted);
  const findingCount =
    findings.expectedMissingTopics.length +
    findings.unexpectedTopics.length +
    findings.expectedMissingActions.length +
    findings.highRiskToolsNotDocumentedInAgentSpec.length +
    findings.missingFallbackHandoffCoverage.length +
    findings.testsReferencingMissingRoutesOrActions.length;

  return {
    experimental: true,
    solutionPath: options.solutionPath,
    extracted,
    findings,
    summary: {
      findingCount,
      expectedTopicCount: options.spec.routes.length,
      extractedTopicCount: extracted.topics.length,
      expectedActionCount: options.spec.tools.length,
      extractedActionCount: extracted.actions.length
    }
  };
}

async function extractSolution(solutionPath: string): Promise<ExtractedSolution> {
  const buffer = await readFile(solutionPath);
  const zip = await JSZip.loadAsync(buffer);
  const files = await Promise.all(
    Object.values(zip.files)
      .filter((file) => !file.dir)
      .map(async (file): Promise<ParsedSolutionFile> => {
        const text = await file.async("string");
        return { path: file.name, text, json: parseJson(text) };
      })
  );

  const topics = new Set<string>();
  const actions = new Map<string, { name: string; riskLevel?: string }>();
  const flows = new Set<string>();
  const knowledgeReferences = new Set<string>();
  const handoffs = new Set<string>();

  for (const file of files) {
    const kind = stringValue(file.json?.kind).toLowerCase();
    const path = file.path.toLowerCase();
    const name = stringValue(file.json?.name) || inferNameFromPath(file.path);

    if (kind === "topic" || path.includes("topic")) {
      topics.add(name);
      continue;
    }

    if (kind === "action" || path.includes("action")) {
      actions.set(name, { name, riskLevel: optionalString(file.json?.riskLevel ?? file.json?.risk_level) });
      continue;
    }

    if (kind === "flow" || path.includes("workflow") || path.includes("flow")) {
      flows.add(name);
      continue;
    }

    if (kind === "knowledge" || path.includes("knowledge")) {
      knowledgeReferences.add(name);
      continue;
    }

    if (kind === "handoff" || path.includes("handoff")) {
      handoffs.add(name);
    }
  }

  return {
    topics: [...topics].sort(),
    actions: [...actions.values()].sort((left, right) => left.name.localeCompare(right.name)),
    flows: [...flows].sort(),
    knowledgeReferences: [...knowledgeReferences].sort(),
    handoffs: [...handoffs].sort()
  };
}

function compareExtractedSolution(spec: AgentSpecDocument, extracted: ExtractedSolution): CopilotStudioAuditReport["findings"] {
  const expectedTopics = spec.routes.map((route) => route.name).sort();
  const extractedTopics = new Set(extracted.topics);
  const expectedActions = spec.tools.map((tool) => tool.name).sort();
  const extractedActions = new Set(extracted.actions.map((action) => action.name));
  const expectedHandoffs = spec.handoffs.map((handoff) => handoff.name).sort();
  const extractedHandoffs = new Set(extracted.handoffs);
  const specToolNames = new Set(expectedActions);

  const expectedMissingTopics = expectedTopics.filter((topic) => !extractedTopics.has(topic));
  const unexpectedTopics = extracted.topics.filter((topic) => !expectedTopics.includes(topic));
  const expectedMissingActions = expectedActions.filter((action) => !extractedActions.has(action));
  const highRiskToolsNotDocumentedInAgentSpec = extracted.actions.filter(
    (action) => action.riskLevel && highRiskLevels.has(action.riskLevel.toLowerCase()) && !specToolNames.has(action.name)
  );

  const missingFallbackHandoffCoverage = expectedHandoffs.filter((handoff) => !extractedHandoffs.has(handoff));
  const hasExpectedFallback = spec.routes.some((route) => route.target.startsWith("handoff:") && /fallback|unclear|policy gap/i.test(`${route.name} ${route.description} ${route.triggers.join(" ")}`));
  if (hasExpectedFallback && missingFallbackHandoffCoverage.length === 0 && !spec.routes.some((route) => route.name.toLowerCase().includes("fallback") && extractedTopics.has(route.name))) {
    const fallbackRoutes = spec.routes.filter((route) => route.name.toLowerCase().includes("fallback")).map((route) => route.name);
    missingFallbackHandoffCoverage.push(...fallbackRoutes.filter((route) => !extractedTopics.has(route)));
  }

  const testsReferencingMissingRoutesOrActions = (spec.tests ?? [])
    .map((test) => ({
      testName: test.name,
      missingRoutes: test.expected_route && !extractedTopics.has(test.expected_route) ? [test.expected_route] : [],
      missingActions: test.expected_tool_calls.filter((tool) => !extractedActions.has(tool))
    }))
    .filter((item) => item.missingRoutes.length > 0 || item.missingActions.length > 0);

  return {
    expectedMissingTopics,
    unexpectedTopics,
    expectedMissingActions,
    highRiskToolsNotDocumentedInAgentSpec,
    missingFallbackHandoffCoverage: [...new Set(missingFallbackHandoffCoverage)].sort(),
    testsReferencingMissingRoutesOrActions
  };
}

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function inferNameFromPath(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[^.]+$/, "");
}
