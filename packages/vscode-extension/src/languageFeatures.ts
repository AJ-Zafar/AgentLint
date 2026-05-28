import {
  CodeActionKind,
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  MarkupKind,
  type CodeAction,
  type CompletionItem,
  type Diagnostic,
  type Hover,
  type Location
} from "vscode-languageserver/node.js";
import { analyzeAgentSpecText } from "./analysis.js";

const sectionDocs: Record<string, string> = {
  agent: "Agent metadata: name, description, version, owner and domain.",
  persona: "Persona guidance: role, tone, verbosity and style rules.",
  instructions: "Instruction rules: primary goal, secondary goals, do and do_not lists.",
  constraints: "Safety, privacy, compliance, escalation and data access boundaries.",
  tools: "Tool definitions with allowed operations, forbidden operations, authentication and risk.",
  routes: "Route definitions with triggers, targets, priorities and optional conditions.",
  handoffs: "Handoff definitions for escalation destinations and required context.",
  tests: "Deterministic test scenarios for route, handoff and tool expectations."
};

export function getAgentLintCompletions(text: string): CompletionItem[] {
  const names = collectDefinitions(text);
  const base = [
    "agent",
    "persona",
    "instructions",
    "constraints",
    "tools",
    "routes",
    "handoffs",
    "tests",
    "conditions",
    "all",
    "any",
    "not",
    "target: tool:",
    "target: handoff:"
  ].map((label) => ({ label, kind: CompletionItemKind.Property }));

  return [
    ...base,
    ...names.tools.map((tool) => ({ label: `target: tool:${tool.name}`, kind: CompletionItemKind.Reference, detail: "Agent Lint tool target" })),
    ...names.handoffs.map((handoff) => ({ label: `target: handoff:${handoff.name}`, kind: CompletionItemKind.Reference, detail: "Agent Lint handoff target" })),
    ...names.routes.map((route) => ({ label: route.name, kind: CompletionItemKind.Value, detail: "Agent Lint route" })),
    {
      label: "route snippet",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: "- name: ${1:route_name}\n  description: ${2:Description}\n  triggers:\n    - ${3:trigger}\n  target: tool:${4:tool_name}\n  priority: ${5:10}"
    }
  ];
}

export function getAgentLintHover(text: string, line: number, character: number): Hover | undefined {
  const word = wordAt(text, line, character);
  const doc = sectionDocs[word];
  if (!doc) return undefined;

  return { contents: { kind: MarkupKind.Markdown, value: `**${word}**\n\n${doc}` } };
}

export function getAgentLintDiagnostics(text: string, uri = "memory://agent.agentspec.yaml"): Diagnostic[] {
  return analyzeAgentSpecText(text, uri).diagnostics.map((diagnostic) => ({
    range: rangeForPath(text, diagnostic.path),
    severity: severity(diagnostic.severity),
    source: diagnostic.source,
    code: diagnostic.code,
    message: diagnostic.message,
    data: diagnostic
  }));
}

export function getAgentLintCodeActions(_text: string, diagnostics: Diagnostic[]): CodeAction[] {
  return diagnostics.flatMap((diagnostic) => {
    if (diagnostic.code === "missing-primary-goal") {
      return [
        {
          title: "Add a placeholder primary goal",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          isPreferred: true
        }
      ];
    }
    if (diagnostic.code === "missing-fallback-route") {
      return [
        {
          title: "Add a fallback route",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic]
        }
      ];
    }
    return [];
  });
}

export function getAgentLintDefinition(text: string, uri: string, line: number, character: number): Location | undefined {
  const word = wordAt(text, line, character);
  if (!word) return undefined;

  const definitions = collectDefinitions(text);
  const found = [...definitions.routes, ...definitions.tools, ...definitions.handoffs].find((definition) => definition.name === word);
  if (!found) return undefined;

  return { uri, range: { start: { line: found.line, character: found.character }, end: { line: found.line, character: found.character + found.name.length } } };
}

function collectDefinitions(text: string): { routes: Definition[]; tools: Definition[]; handoffs: Definition[] } {
  const result = { routes: [] as Definition[], tools: [] as Definition[], handoffs: [] as Definition[] };
  let section = "";
  const lines = text.split(/\r?\n/);

  for (const [line, value] of lines.entries()) {
    const sectionMatch = value.match(/^([a-z_]+):\s*$/);
    if (sectionMatch?.[1]) section = sectionMatch[1];

    const nameMatch = value.match(/^\s*-?\s*name:\s*([A-Za-z0-9_-]+)/);
    if (!nameMatch?.[1]) continue;

    const definition = { name: nameMatch[1], line, character: value.indexOf(nameMatch[1]) };
    if (section === "routes") result.routes.push(definition);
    if (section === "tools") result.tools.push(definition);
    if (section === "handoffs") result.handoffs.push(definition);
  }

  return result;
}

type Definition = { name: string; line: number; character: number };

function wordAt(text: string, line: number, character: number): string {
  const currentLine = text.split(/\r?\n/)[line] ?? "";
  const isWord = /[A-Za-z0-9_-]/;
  let start = Math.min(character, currentLine.length);
  let end = Math.min(character, currentLine.length);
  while (start > 0 && isWord.test(currentLine[start - 1])) start -= 1;
  while (end < currentLine.length && isWord.test(currentLine[end])) end += 1;
  return currentLine.slice(start, end);
}

function rangeForPath(text: string, path: string) {
  const key = path.split(".").find((part) => Number.isNaN(Number(part))) ?? path;
  const lines = text.split(/\r?\n/);
  for (const [line, value] of lines.entries()) {
    if (new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`).test(value)) {
      return { start: { line, character: 0 }, end: { line, character: Math.max(value.length, 1) } };
    }
  }
  return { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
}

function severity(value: "error" | "warning" | "info"): DiagnosticSeverity {
  if (value === "error") return DiagnosticSeverity.Error;
  if (value === "warning") return DiagnosticSeverity.Warning;
  return DiagnosticSeverity.Information;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
