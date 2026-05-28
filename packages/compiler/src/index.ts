import { stringify } from "yaml";
import type { AgentSpecDocument } from "@agentspec/spec";

export type CompileResult = {
  document: AgentSpecDocument;
  yaml: string;
  warnings: string[];
  confidence: Record<string, number>;
};

type Sections = Record<string, string[]>;

const ambiguousPatterns = [/\bappropriate\b/i, /\bas needed\b/i, /\bwhen needed\b/i, /\bwhen possible\b/i, /\buse best judgement\b/i];

export function compileInstructionsToAgentSpec(input: string): CompileResult {
  const title = extractTitle(input);
  const sections = splitSections(input);
  const confidence: Record<string, number> = {};
  const inferredFields: string[] = [];
  const warnings = findAmbiguityWarnings(input);

  const primaryGoal = extractGoal(input);
  confidence["instructions.primary_goal"] = primaryGoal.confidence;
  inferredFields.push("instructions.primary_goal");

  const doRules = extractBullets(sections.do).filter(Boolean);
  const doNotRules = uniqueStrings([...extractBullets(sections["do not"]), ...extractNeverRules(input)].filter(Boolean));
  markConfidence(confidence, inferredFields, "instructions.do", doRules, 0.74);
  markConfidence(confidence, inferredFields, "instructions.do_not", doNotRules, 0.78);

  const tool = inferTool(input, sections);
  markConfidence(confidence, inferredFields, "tools", [tool.name], tool.confidence);

  const route = inferRoute(input, sections, tool.name);
  confidence[`routes.${route.name}.conditions`] = route.confidence;
  inferredFields.push(`routes.${route.name}.conditions`);

  const handoff = inferHandoff(input);
  confidence[`handoffs.${handoff.name}`] = handoff.confidence;
  inferredFields.push(`handoffs.${handoff.name}`);

  const document: AgentSpecDocument = {
    agent: {
      name: title,
      description: `Compiled from loose natural language instructions for ${title}.`,
      version: "0.1.0",
      owner: "unassigned",
      domain: inferDomain(input)
    },
    persona: {
      role: `${title} assistant`,
      tone: "professional and concise",
      verbosity: "concise",
      style_rules: ["Use clear language.", "Escalate when policy or context is unclear."]
    },
    instructions: {
      primary_goal: primaryGoal.value,
      secondary_goals: ["Resolve requests using the compiled routes and constraints.", "Escalate ambiguous or high-risk cases."],
      do: doRules.length > 0 ? doRules : ["Use declared routes before answering."],
      do_not: doNotRules.length > 0 ? doNotRules : ["Do not invent policy or tool results."]
    },
    constraints: {
      safety: ["Escalate safety or policy uncertainty to the configured handoff."],
      privacy: inferPrivacy(input),
      compliance: inferCompliance(input),
      escalation: [handoff.condition],
      data_access: inferDataAccess(input, tool.name)
    },
    tools: [
      {
        name: tool.name,
        description: tool.description,
        allowed_operations: tool.allowedOperations,
        forbidden_operations: tool.forbiddenOperations,
        requires_auth: /authenticat|account|customer|employee|user/i.test(input),
        risk_level: "medium"
      }
    ],
    routes: [
      {
        name: route.name,
        description: route.description,
        triggers: route.triggers,
        target: `tool:${tool.name}`,
        priority: 10,
        conditions: route.conditions
      },
      {
        name: `fallback_${handoff.name}`,
        description: "Fallback route inferred for unclear, unauthenticated or policy-sensitive requests.",
        triggers: ["fallback", "unclear", "policy"],
        target: `handoff:${handoff.name}`,
        priority: 100
      }
    ],
    handoffs: [
      {
        name: handoff.name,
        condition: handoff.condition,
        destination: `queue:${handoff.name.replace(/_/g, "-")}`,
        required_context: ["request_summary", "matched_route", "ambiguity_warnings"]
      }
    ],
    tests: [
      {
        name: `${route.name} compiled route`,
        input: route.testInput,
        expected_route: route.name,
        expected_handoff: handoff.name,
        expected_tool_calls: [tool.name],
        forbidden_tool_calls: [],
        assertions: [`route is ${route.name}`, `calls tool ${tool.name}`]
      }
    ],
    compiler: {
      generated_by: "agentlint-natural-language-compiler",
      status: "experimental",
      confidence,
      inferred_fields: inferredFields,
      warnings
    }
  };

  const yaml = stringify(document, { sortMapEntries: false });
  return { document, yaml, warnings, confidence };
}

function splitSections(input: string): Sections {
  const sections: Sections = {};
  let current = "body";
  for (const line of input.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s*(.+?)\s*$/) ?? line.match(/^([A-Za-z ]+):\s*$/);
    if (heading?.[1]) {
      current = heading[1].trim().toLowerCase();
      sections[current] ??= [];
      continue;
    }
    sections[current] ??= [];
    sections[current].push(line);
  }
  return sections;
}

function extractTitle(input: string): string {
  return input.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Compiled Agent";
}

function extractGoal(input: string): { value: string; confidence: number } {
  const explicit = input.match(/^(?:Goal|Primary goal):\s*(.+)$/im)?.[1]?.trim();
  if (explicit) return { value: explicit, confidence: 0.88 };
  const firstSentence = input.replace(/^#.*$/m, "").match(/([A-Z][^.!?]+[.!?])/m)?.[1]?.trim();
  return { value: firstSentence ?? "Route requests using compiled instructions.", confidence: firstSentence ? 0.55 : 0.35 };
}

function extractBullets(lines: string[] = []): string[] {
  return lines.map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim()).filter((value): value is string => Boolean(value));
}

function extractNeverRules(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => /^(Never|Do not)\b/i.test(line) && !line.endsWith(":"));
}

function inferTool(input: string, sections: Sections): { name: string; description: string; allowedOperations: string[]; forbiddenOperations: string[]; confidence: number } {
  const toolLine = extractBullets(sections.tools)[0] ?? input.match(/\b([a-z][a-z0-9]+_[a-z0-9_]+)\b/)?.[1] ?? "context_lookup";
  const name = (toolLine.match(/^([a-z][a-z0-9_]+)/i)?.[1] ?? "context_lookup").toLowerCase();
  const description = toolLine.includes(":") ? toolLine.split(":").slice(1).join(":").trim() : `Inferred tool reference ${name}.`;
  const allowedOperations = [...new Set((description.match(/read [a-z ]+/gi) ?? ["read context"]).map(toOperation))];
  const forbiddenOperations = [...new Set((input.match(/(?:Do not|Never) ([^.\n]+)/gi) ?? ["Do not expose secrets"]).map((value) => toOperation(value.replace(/^(Do not|Never)\s+/i, ""))))];
  return { name, description, allowedOperations, forbiddenOperations, confidence: name === "context_lookup" ? 0.45 : 0.82 };
}

function inferRoute(input: string, sections: Sections, toolName: string) {
  const routeLine = extractBullets(sections.routes).find((line) => /intent|route|refund|request/i.test(line)) ?? "If intent is request, route to compiled_route.";
  const intent = routeLine.match(/intent (?:is|==) ([a-z0-9_-]+)/i)?.[1] ?? routeLine.match(/\b(refund|invoice|support|request)\b/i)?.[1]?.toLowerCase() ?? "request";
  const routeName = routeLine.match(/route to ([a-z0-9_-]+)/i)?.[1] ?? `${intent}_route`;
  const conditions: string[] = [`intent == ${intent}`];
  if (/authenticated (?:is )?true|authenticated == true/i.test(routeLine)) conditions.push("authenticated == true");
  const amount = routeLine.match(/amount (?:is )?(?:less than|<)\s*(\d+)/i)?.[1];
  if (amount) conditions.push(`amount < ${amount}`);
  return {
    name: routeName,
    description: `Compiled route for ${intent} requests using ${toolName}.`,
    triggers: [intent],
    conditions: { all: conditions },
    confidence: conditions.length > 1 ? 0.82 : 0.58,
    testInput: `I need help with ${intent}.`
  };
}

function inferHandoff(input: string): { name: string; condition: string; confidence: number } {
  const name = input.match(/Escalate to ([a-z0-9_-]+)/i)?.[1] ?? input.match(/fallback to ([a-z0-9_-]+)/i)?.[1] ?? "human_review";
  const condition = input.match(/Escalate to [a-z0-9_-]+ when (.+)$/im)?.[1]?.trim() ?? "Escalate when the request is unclear or policy-sensitive.";
  return { name, condition, confidence: name === "human_review" ? 0.55 : 0.82 };
}

function inferDomain(input: string): string {
  if (/refund|invoice|customer/i.test(input)) return "customer-support";
  return "compiled-instructions";
}

function inferPrivacy(input: string): string[] {
  const privacy = input.match(/^Privacy:\s*(.+)$/im)?.[1]?.trim();
  return [privacy ?? "Do not expose personal or sensitive information."];
}

function inferCompliance(input: string): string[] {
  const compliance = input.match(/^Compliance:\s*(.+)$/im)?.[1]?.trim();
  return [compliance ?? "Follow applicable policy."];
}

function inferDataAccess(input: string, toolName: string): string[] {
  const dataAccess = input.match(/^Data access:\s*(.+)$/im)?.[1]?.trim();
  return [dataAccess ?? `Only use data returned by ${toolName}.`];
}

function findAmbiguityWarnings(input: string): string[] {
  return ambiguousPatterns
    .filter((pattern) => pattern.test(input))
    .map((pattern) => `Ambiguous language detected: ${pattern.source.replace(/\\b/g, "")}`);
}

function markConfidence(confidence: Record<string, number>, inferredFields: string[], prefix: string, values: string[], score: number): void {
  values.forEach((_, index) => {
    confidence[`${prefix}.${index}`] = score;
    inferredFields.push(`${prefix}.${index}`);
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function toOperation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
