import { parse } from "yaml";
import { validateAgentSpec, type AgentSpecDocument, type AgentSpecValidationIssue } from "@agentspec/spec";

export type ParsedAgentSpec = {
  source: string;
  document: AgentSpecDocument;
};

export class AgentSpecParseError extends Error {
  readonly source: string;
  readonly issues: AgentSpecValidationIssue[];

  constructor(source: string, issues: AgentSpecValidationIssue[]) {
    const message = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    super(`Invalid AgentSpec in ${source}: ${message}`);
    this.name = "AgentSpecParseError";
    this.source = source;
    this.issues = issues;
  }
}

export function parseAgentSpecYaml(contents: string, options: { source?: string } = {}): ParsedAgentSpec {
  const source = options.source ?? "inline";
  const parsed = parse(contents);
  const validation = validateAgentSpec(parsed);

  if (!validation.success) {
    throw new AgentSpecParseError(source, validation.issues);
  }

  return {
    source,
    document: validation.data
  };
}

export async function parseAgentSpecFile(filePath: string): Promise<ParsedAgentSpec> {
  const { readFile } = await import("node:fs/promises");
  const contents = await readFile(filePath, "utf8");
  return parseAgentSpecYaml(contents, { source: filePath });
}
