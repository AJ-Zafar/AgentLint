import { Command, CommanderError } from "commander";
import { AgentSpecParseError, parseAgentSpecFile, type ParsedAgentSpec } from "@agentspec/parser";
import { lintAgentSpec } from "@agentspec/linter";
import { runAgentSpecTests, type TestRunResult } from "@agentspec/test-runner";
import { diffAgentSpecs, simulateAgentSpecDiff, type BehavioralDiffResult, type SimulatedDiffReport } from "@agentspec/diff";
import { compileAgentSpecGraph, type GraphCompilationResult } from "@agentspec/grammar";
import { compileInstructionsToAgentSpec } from "@agentspec/compiler";
import { readFile } from "node:fs/promises";
import { convertAgentSpecToCopilotStudioPlan } from "@agentspec/copilot-studio";
import { auditCopilotStudioSolution, type CopilotStudioAuditReport } from "@agentspec/copilot-studio-audit";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CliState = {
  exitCode: number;
  stdout: string[];
  stderr: string[];
};

export function createCli(state: CliState, programName = "agentspec"): Command {
  const program = new Command();

  program
    .name(programName)
    .description("Local-first tooling for AI agent instruction specifications.")
    .exitOverride()
    .configureOutput({
      writeOut: (value) => state.stdout.push(value),
      writeErr: (value) => state.stderr.push(value)
    });

  program
    .command("validate")
    .argument("<file>", "AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Validate an AgentSpec YAML file.")
    .action(async (file: string, options: { json?: boolean }) => {
      const parsed = await parseForCommand(file, state, "validate", options.json);
      if (!parsed) {
        return;
      }

      const payload = { command: "validate", file, valid: true, diagnostics: [] };
      state.stdout.push(options.json ? jsonLine(payload) : `${file} is valid\n`);
    });

  program
    .command("lint")
    .argument("<file>", "AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Lint an AgentSpec YAML file for instruction-engineering issues.")
    .action(async (file: string, options: { json?: boolean }) => {
      const parsed = await parseForCommand(file, state, "lint", options.json);
      if (!parsed) {
        return;
      }

      const result = lintAgentSpec(parsed.document);
      const payload = {
        command: "lint",
        file,
        success: result.issues.length === 0,
        issueCount: result.issues.length,
        issues: result.issues
      };

      if (result.issues.length === 0) {
        state.stdout.push(options.json ? jsonLine(payload) : `${file}: no lint issues\n`);
        return;
      }

      state.exitCode = 1;
      state.stdout.push(options.json ? jsonLine(payload) : formatLintIssues(result.issues));
    });

  program
    .command("test")
    .argument("<file>", "AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Run deterministic declared AgentSpec tests without live model calls.")
    .action(async (file: string, options: { json?: boolean }) => {
      const parsed = await parseForCommand(file, state, "test", options.json);
      if (!parsed) {
        return;
      }

      const result = runAgentSpecTests(parsed.document);
      const payload = { command: "test", file, success: result.summary.failed === 0, summary: result.summary, tests: result.tests };

      state.stdout.push(options.json ? jsonLine(payload) : formatTestRun(result));
      if (result.summary.failed > 0) {
        state.exitCode = 1;
      }
    });

  program
    .command("compile")
    .argument("<file>", "Markdown or text file containing loose natural language instructions")
    .description("Experimentally compile loose natural language instructions into Agent Lint YAML.")
    .action(async (file: string) => {
      const input = await readFile(file, "utf8");
      const result = compileInstructionsToAgentSpec(input);
      state.stdout.push(result.yaml);
    });

  program
    .command("graph")
    .argument("<file>", "Agent Lint YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .option("--mermaid", "Emit Mermaid flowchart output")
    .option("--ascii", "Emit ASCII graph output")
    .description("Compile an Agent Lint spec into an internal behaviour graph.")
    .action(async (file: string, options: { json?: boolean; mermaid?: boolean; ascii?: boolean }) => {
      const parsed = await parseForCommand(file, state, "graph", options.json);
      if (!parsed) {
        return;
      }

      const result = compileAgentSpecGraph(parsed.document);
      const payload = { command: "graph", file, graph: result.graph, diagnostics: result.diagnostics };
      const output = options.json ? jsonLine(payload) : options.mermaid ? formatGraphMermaid(result) : formatGraph(result);
      state.stdout.push(output);
      if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        state.exitCode = 1;
      }
    });

  program
    .command("copilot-plan")
    .argument("<file>", "AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Generate an experimental Microsoft Copilot Studio implementation plan.")
    .action(async (file: string, options: { json?: boolean }) => {
      const parsed = await parseForCommand(file, state, "copilot-plan", options.json);
      if (!parsed) {
        return;
      }

      const markdown = convertAgentSpecToCopilotStudioPlan(parsed.document);
      const payload = { command: "copilot-plan", file, format: "markdown", markdown };
      state.stdout.push(options.json ? jsonLine(payload) : markdown);
    });

  program
    .command("copilot-audit")
    .requiredOption("--spec <file>", "AgentSpec YAML file")
    .requiredOption("--solution <file>", "Microsoft Power Platform solution export zip")
    .option("--json", "Emit machine-readable JSON output")
    .description("Experimentally audit a local Copilot Studio solution export against an AgentSpec file.")
    .action(async (options: { spec: string; solution: string; json?: boolean }) => {
      const parsed = await parseForCommand(options.spec, state, "copilot-audit", options.json);
      if (!parsed) {
        return;
      }

      const report = await auditCopilotStudioSolution({ spec: parsed.document, solutionPath: options.solution });
      const payload = { command: "copilot-audit", specFile: options.spec, solutionFile: options.solution, report };
      state.stdout.push(options.json ? jsonLine(payload) : formatCopilotAudit(report));
    });

  program
    .command("simulate-diff")
    .argument("<oldFile>", "Original Agent Lint YAML file")
    .argument("<newFile>", "Updated Agent Lint YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Simulate behavioural impact between two Agent Lint specs.")
    .action(async (oldFile: string, newFile: string, options: { json?: boolean }) => {
      const oldSpec = await parseForCommand(oldFile, state, "simulate-diff", options.json);
      if (!oldSpec) return;
      const newSpec = await parseForCommand(newFile, state, "simulate-diff", options.json);
      if (!newSpec) return;
      const report = simulateAgentSpecDiff(oldSpec.document, newSpec.document);
      const payload = { command: "simulate-diff", oldFile, newFile, report };
      state.stdout.push(options.json ? jsonLine(payload) : formatSimulatedDiff(report));
    });

  program
    .command("diff")
    .argument("<oldFile>", "Original AgentSpec YAML file")
    .argument("<newFile>", "Updated AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Report behavioral impact between two AgentSpec YAML files.")
    .action(async (oldFile: string, newFile: string, options: { json?: boolean }) => {
      const oldSpec = await parseForCommand(oldFile, state, "diff", options.json);
      if (!oldSpec) {
        return;
      }
      const newSpec = await parseForCommand(newFile, state, "diff", options.json);
      if (!newSpec) {
        return;
      }
      const result = diffAgentSpecs(oldSpec.document, newSpec.document);
      const payload = { command: "diff", oldFile, newFile, impact: result.impact, summary: result.summary, changes: result.changes };

      state.stdout.push(options.json ? jsonLine(payload) : formatBehavioralDiff(result));
    });

  return program;
}

async function parseForCommand(
  file: string,
  state: CliState,
  command: string,
  json?: boolean
): Promise<ParsedAgentSpec | undefined> {
  try {
    return await parseAgentSpecFile(file);
  } catch (error) {
    if (json && error instanceof AgentSpecParseError) {
      state.exitCode = 1;
      state.stdout.push(
        jsonLine({
          command,
          file,
          valid: false,
          diagnostics: error.issues.map((issue) => ({
            severity: "error",
            path: issue.path,
            message: issue.message
          }))
        })
      );
      return undefined;
    }

    throw error;
  }
}

function jsonLine(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatLintIssues(issues: Array<{ severity: string; ruleId: string; path: string; message: string; suggestion: string; confidence: number }>): string {
  const groups = [
    { severity: "error", title: "Errors" },
    { severity: "warning", title: "Warnings" },
    { severity: "info", title: "Info" }
  ];
  const lines: string[] = [];

  for (const group of groups) {
    const groupIssues = issues.filter((issue) => issue.severity === group.severity);
    if (groupIssues.length === 0) {
      continue;
    }

    lines.push(`${group.title} (${groupIssues.length})`);
    for (const issue of groupIssues) {
      lines.push(`  - ${issue.ruleId} [${issue.path}]`);
      lines.push(`    ${issue.message}`);
      lines.push(`    Suggestion: ${issue.suggestion}`);
      lines.push(`    Confidence: ${Math.round(issue.confidence * 100)}%`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function runCli(args: string[], programName = "agentspec"): Promise<CliResult> {
  const state: CliState = {
    exitCode: 0,
    stdout: [],
    stderr: []
  };
  const program = createCli(state, programName);

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      state.exitCode = error.exitCode;
      if (error.message && error.code !== "commander.helpDisplayed") {
        state.stderr.push(`${error.message}\n`);
      }
    } else if (error instanceof Error) {
      state.exitCode = 1;
      state.stderr.push(`${error.message}\n`);
    } else {
      state.exitCode = 1;
      state.stderr.push(`${String(error)}\n`);
    }
  }

  return {
    exitCode: state.exitCode,
    stdout: state.stdout.join(""),
    stderr: state.stderr.join("")
  };
}

function formatTestRun(result: TestRunResult): string {
  const lines: string[] = ["AgentSpec Test Results"];
  const passed = result.tests.filter((test) => test.passed);
  const failed = result.tests.filter((test) => !test.passed);

  if (passed.length > 0) {
    lines.push("", `Passed (${passed.length})`);
    for (const test of passed) {
      lines.push(`  - ${test.name}`);
      lines.push(
        `    route=${test.actual.route ?? "none"}, handoff=${test.actual.handoff ?? "none"}, tools=${formatList(test.actual.toolCalls)}`
      );
    }
  }

  if (failed.length > 0) {
    lines.push("", `Failed (${failed.length})`);
    for (const test of failed) {
      lines.push(`  - ${test.name}`);
      for (const failure of test.failures) {
        lines.push(`    Reason: ${failure.reason}`);
        lines.push(`    Expected: ${formatValue(failure.expected)}`);
        lines.push(`    Actual: ${formatValue(failure.actual)}`);
      }
    }
  }

  lines.push(
    "",
    `Summary: ${result.summary.passed}/${result.summary.total} passed, ${result.summary.failed} failed, score ${result.summary.score}%`
  );

  return `${lines.join("\n")}\n`;
}

function formatList(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatGraph(result: GraphCompilationResult): string {
  const lines = [
    "Agent Lint Behaviour Graph",
    `Nodes: ${result.graph.nodes.length}`,
    `Edges: ${result.graph.edges.length}`,
    `Precedence: ${formatList(result.graph.precedence)}`,
    "",
    "Nodes",
    ...result.graph.nodes.map((node) => `  - ${node.id} (${node.kind})`),
    "",
    "Edges",
    ...result.graph.edges.map((edge) => `  - ${edge.from} -> ${edge.to} <${edge.kind}>${edge.label ? ` [${edge.label}]` : ""}`),
    ""
  ];

  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics", ...result.diagnostics.map((diagnostic) => `  - ${diagnostic.severity} ${diagnostic.code} [${diagnostic.path}]: ${diagnostic.message}`), "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function formatGraphMermaid(result: GraphCompilationResult): string {
  const lines = ["flowchart LR"];
  for (const node of result.graph.nodes) {
    lines.push(`  ${mermaidId(node.id)}["${escapeMermaidLabel(`${node.label}\n(${node.kind})`)}"]`);
  }
  for (const edge of result.graph.edges) {
    const label = edge.label ? `|${escapeMermaidLabel(edge.label)}|` : "";
    lines.push(`  ${mermaidId(edge.from)} -->${label} ${mermaidId(edge.to)}`);
  }
  if (result.diagnostics.length > 0) {
    lines.push("  %% Diagnostics");
    for (const diagnostic of result.diagnostics) {
      lines.push(`  %% ${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function mermaidId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, "'");
}

function formatCopilotAudit(report: CopilotStudioAuditReport): string {
  const lines = [
    "Copilot Studio Audit Report",
    "Status: experimental",
    "No Microsoft APIs are called. Solution internals may change.",
    `Solution: ${report.solutionPath}`,
    `Findings: ${report.summary.findingCount}`,
    "",
    "Extracted components",
    `  Topics: ${formatList(report.extracted.topics)}`,
    `  Actions: ${formatList(report.extracted.actions.map((action) => action.riskLevel ? `${action.name} (${action.riskLevel})` : action.name))}`,
    `  Flows: ${formatList(report.extracted.flows)}`,
    `  Knowledge: ${formatList(report.extracted.knowledgeReferences)}`,
    `  Handoffs: ${formatList(report.extracted.handoffs)}`,
    ""
  ];

  appendFindingList(lines, "Expected but missing topics", report.findings.expectedMissingTopics);
  appendFindingList(lines, "Unexpected topics", report.findings.unexpectedTopics);
  appendFindingList(lines, "Expected but missing actions/tools", report.findings.expectedMissingActions);
  appendFindingList(
    lines,
    "High-risk tools not documented in AgentSpec",
    report.findings.highRiskToolsNotDocumentedInAgentSpec.map((tool) => tool.riskLevel ? `${tool.name} (${tool.riskLevel})` : tool.name)
  );
  appendFindingList(lines, "Missing fallback/handoff coverage", report.findings.missingFallbackHandoffCoverage);
  appendFindingList(
    lines,
    "Tests referencing missing routes/actions",
    report.findings.testsReferencingMissingRoutesOrActions.map((test) => {
      const parts = [
        ...test.missingRoutes.map((route) => `route:${route}`),
        ...test.missingActions.map((action) => `action:${action}`)
      ];
      return `${test.testName} (${parts.join(", ")})`;
    })
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function appendFindingList(lines: string[], title: string, values: string[]): void {
  lines.push(title);
  if (values.length === 0) {
    lines.push("  - none", "");
    return;
  }
  for (const value of values) {
    lines.push(`  - ${value}`);
  }
  lines.push("");
}

function formatSimulatedDiff(report: SimulatedDiffReport): string {
  const lines = [
    "Agent Lint Simulated Behavioural Diff",
    `Behavioural impact: ${report.impact}`,
    `Scenarios: ${report.summary.changedScenarioCount}/${report.summary.totalScenarios} changed (${Math.round(report.summary.routeChangeRate * 100)}%)`,
    "",
    "Route selection probability changes",
    ...formatObjects(report.routeSelectionChanges.map((change) => `${change.route}: ${change.beforeProbability} -> ${change.afterProbability}`)),
    "",
    "Escalation frequency changes",
    `  - ${report.escalationFrequencyChange.before} -> ${report.escalationFrequencyChange.after} (delta ${report.escalationFrequencyChange.delta})`,
    "",
    "Tool eligibility changes",
    ...formatObjects(report.toolEligibilityChanges.map((change) => `${change.tool}: ${change.beforeEligible} -> ${change.afterEligible}`)),
    "",
    "Fallback invocation changes",
    `  - ${report.fallbackInvocationChange.before} -> ${report.fallbackInvocationChange.after} (delta ${report.fallbackInvocationChange.delta})`,
    "",
    "Constraint precedence changes",
    ...formatObjects(report.constraintPrecedenceChanges),
    "",
    "Impacted routes",
    ...formatObjects(report.impactedRoutes),
    "",
    "Changed paths",
    ...formatObjects(report.changedPaths),
    "",
    "Newly unreachable states",
    ...formatObjects(report.newlyUnreachableStates),
    "",
    "Likely regression areas",
    ...formatObjects(report.likelyRegressionAreas),
    ""
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

function formatObjects(values: string[]): string[] {
  return values.length === 0 ? ["  - none"] : values.map((value) => `  - ${value}`);
}

function formatBehavioralDiff(result: BehavioralDiffResult): string {
  const lines: string[] = [
    "AgentSpec Behavioral Diff",
    `Overall impact: ${result.impact}`,
    `Summary: ${result.summary.total} changes (${result.summary.breaking} breaking, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low)`
  ];

  if (result.changes.length === 0) {
    lines.push("", "No behavioral changes detected.");
    return `${lines.join("\n")}\n`;
  }

  const impacts = ["breaking", "high", "medium", "low"] as const;
  for (const impact of impacts) {
    const changes = result.changes.filter((change) => change.impact === impact);
    if (changes.length === 0) {
      continue;
    }

    lines.push("", `${titleCase(impact)} impact (${changes.length})`);
    for (const change of changes) {
      lines.push(`  - ${change.type} [${change.path}]`);
      lines.push(`    ${change.message}`);
      lines.push(`    Before: ${formatValue(change.before)}`);
      lines.push(`    After: ${formatValue(change.after)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

type DiffChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export function diffValues(before: unknown, after: unknown, path = ""): DiffChange[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (!isRecord(before) || !isRecord(after)) {
    return [{ path: path || "$", before, after }];
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: DiffChange[] = [];

  for (const key of [...keys].sort()) {
    changes.push(...diffValues(before[key], after[key], path ? `${path}.${key}` : key));
  }

  return changes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}
