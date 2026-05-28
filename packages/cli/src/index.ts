import { Command, CommanderError } from "commander";
import { AgentSpecParseError, parseAgentSpecFile, type ParsedAgentSpec } from "@agentspec/parser";
import { lintAgentSpec, lintRules } from "@agentspec/linter";
import { runAgentSpecTests, type TestRunResult } from "@agentspec/test-runner";
import { diffAgentSpecs, simulateAgentSpecDiff, type BehavioralDiffResult, type SimulatedDiffReport } from "@agentspec/diff";
import { compileAgentSpecGraph, type GraphCompilationResult } from "@agentspec/grammar";
import { renderReplayMermaid, replayScenario, type ReplayResult } from "@agentspec/replay";
import { analyseBehaviouralCoverage, type BehaviouralCoverageReport } from "@agentspec/coverage";
import { generateGovernanceMarkdownReport } from "@agentspec/report";
import { compileInstructionsToAgentSpec } from "@agentspec/compiler";
import { readFile, writeFile } from "node:fs/promises";
import { convertAgentSpecToCopilotStudioPlan } from "@agentspec/copilot-studio";
import { auditCopilotStudioSolution, analyseCopilotStudioDrift, generateAgentSpecFromCopilotStudioSolution, type CopilotStudioAuditReport, type CopilotStudioDriftReport } from "@agentspec/copilot-studio-audit";
import { parse as parseYaml, stringify } from "yaml";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CliState = {
  exitCode: number;
  stdout: string[];
  stderr: string[];
  args: string[];
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
    .command("explain-lint")
    .argument("<ruleId>", "Agent Lint lint rule id")
    .description("Explain a lint rule with examples and remediation guidance.")
    .action((ruleId: string) => {
      const rule = lintRules.find((candidate) => candidate.ruleId === ruleId);
      if (!rule) {
        state.exitCode = 1;
        state.stderr.push(`Unknown lint rule: ${ruleId}\n`);
        return;
      }
      state.stdout.push(formatLintRuleExplanation(rule));
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
    .option("--policy <pack...>", "Apply one or more built-in policy packs")
    .option("--fix", "Apply deterministic safe fixes where possible")
    .description("Lint an AgentSpec YAML file for instruction-engineering issues.")
    .action(async (file: string, options: { json?: boolean; policy?: string[]; fix?: boolean }) => {
      const shouldFix = options.fix || state.args.includes("--fix");
      if (shouldFix) {
        const fix = await applyLintFixes(file);
        const parsedAfterFix = await parseForCommand(file, state, "lint", options.json);
        if (!parsedAfterFix) return;
        const policyPacks = options.policy ?? [];
        const result = lintAgentSpec(parsedAfterFix.document, { policyPacks: policyPacks as never[] });
        const payload = { command: "lint", file, policyPacks, success: result.issues.length === 0 && fix.manualReviewRequired.length === 0, issueCount: result.issues.length, issues: result.issues, fix };
        if (fix.applied.length > 0 || fix.skipped.length > 0 || fix.manualReviewRequired.length > 0) state.exitCode = 1;
        state.stdout.push(options.json ? jsonLine(payload) : formatFixResult(file, fix, result.issues));
        return;
      }

      const parsed = await parseForCommand(file, state, "lint", options.json);
      if (!parsed) {
        return;
      }

      const policyPacks = options.policy ?? [];
      const result = lintAgentSpec(parsed.document, { policyPacks: policyPacks as never[] });
      const payload = {
        command: "lint",
        file,
        policyPacks,
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
    .command("coverage")
    .argument("<file>", "Agent Lint YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Analyse behavioural coverage for an Agent Lint spec.")
    .action(async (file: string, options: { json?: boolean }) => {
      const parsed = await parseForCommand(file, state, "coverage", options.json);
      if (!parsed) return;
      const report = analyseBehaviouralCoverage(parsed.document);
      const payload = { command: "coverage", file, report };
      state.stdout.push(options.json ? jsonLine(payload) : formatCoverage(report));
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
    .command("report")
    .argument("<file>", "Agent Lint YAML file")
    .option("--format <format>", "Report format", "markdown")
    .option("--policy <pack...>", "Apply policy packs in the report")
    .description("Generate governance evidence report for architecture review.")
    .action(async (file: string, options: { format: string; policy?: string[] }) => {
      const parsed = await parseForCommand(file, state, "report", false);
      if (!parsed) return;
      if (options.format !== "markdown") {
        state.exitCode = 1;
        state.stderr.push(`Unsupported report format: ${options.format}\n`);
        return;
      }
      state.stdout.push(generateGovernanceMarkdownReport(parsed.document, { policyPacks: options.policy ?? [] }));
    });

  program
    .command("replay")
    .argument("<file>", "Agent Lint YAML file")
    .requiredOption("--scenario <name>", "Scenario name to replay")
    .option("--json", "Emit machine-readable JSON output")
    .option("--mermaid", "Emit Mermaid execution graph output")
    .description("Replay a named scenario through the behaviour graph.")
    .action(async (file: string, options: { scenario: string; json?: boolean; mermaid?: boolean }) => {
      const parsed = await parseForCommand(file, state, "replay", options.json);
      if (!parsed) return;
      const result = replayScenario(parsed.document, options.scenario);
      const payload = { command: "replay", file, result };
      state.stdout.push(options.json ? jsonLine(payload) : options.mermaid ? renderReplayMermaid(result) : formatReplay(result));
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
    .command("copilot-extract")
    .argument("<solution>", "Microsoft Power Platform solution export zip")
    .option("--json", "Emit machine-readable JSON output")
    .description("Experimentally extract a local Copilot Studio solution export into Agent Lint YAML.")
    .action(async (solution: string, options: { json?: boolean }) => {
      const document = await generateAgentSpecFromCopilotStudioSolution(solution);
      const payload = { command: "copilot-extract", solutionFile: solution, spec: document };
      state.stdout.push(options.json ? jsonLine(payload) : stringify(document, { sortMapEntries: false }));
    });

  program
    .command("copilot-drift")
    .requiredOption("--spec <file>", "AgentSpec YAML file")
    .requiredOption("--solution <file>", "Microsoft Power Platform solution export zip")
    .option("--json", "Emit machine-readable JSON output")
    .description("Experimentally analyse drift between AgentSpec and a local Copilot Studio solution export.")
    .action(async (options: { spec: string; solution: string; json?: boolean }) => {
      const parsed = await parseForCommand(options.spec, state, "copilot-drift", options.json);
      if (!parsed) return;
      const drift = await analyseCopilotStudioDrift({ spec: parsed.document, solutionPath: options.solution });
      const payload = { command: "copilot-drift", specFile: options.spec, solutionFile: options.solution, drift };
      state.stdout.push(options.json ? jsonLine(payload) : formatCopilotDrift(drift));
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

function formatLintRuleExplanation(rule: { ruleId: string; severity: string; docs: { description: string; whyItMatters: string; badExample: string; goodExample: string; suggestedFix: string } }): string {
  return [
    `# ${rule.ruleId}`,
    "",
    `Severity: ${rule.severity}`,
    "",
    rule.docs.description,
    "",
    "## Why it matters",
    "",
    rule.docs.whyItMatters,
    "",
    "## Bad example",
    "",
    "```yaml",
    rule.docs.badExample,
    "```",
    "",
    "## Good example",
    "",
    "```yaml",
    rule.docs.goodExample,
    "```",
    "",
    "## Suggested fix",
    "",
    rule.docs.suggestedFix,
    ""
  ].join("\n");
}


type FixEntry = { code: string; message: string; path: string };
type FixResult = { applied: FixEntry[]; skipped: FixEntry[]; manualReviewRequired: FixEntry[] };

async function applyLintFixes(file: string): Promise<FixResult> {
  const source = await readFile(file, "utf8");
  const doc = parseYaml(source) as Record<string, any>;
  const result: FixResult = { applied: [], skipped: [], manualReviewRequired: [] };

  if (!doc || typeof doc !== "object") {
    result.skipped.push({ code: "schema-normalisation-skipped", path: "$", message: "File is not a YAML object." });
    return result;
  }

  doc.tools ??= [];
  for (const [index, tool] of (doc.tools as any[]).entries()) {
    if (!tool.risk_level) {
      tool.risk_level = "medium";
      result.applied.push({ code: "added-risk-level", path: `tools.${index}.risk_level`, message: `Added default risk_level: medium to tool ${tool.name ?? index}.` });
      result.manualReviewRequired.push({ code: "review-risk-level", path: `tools.${index}.risk_level`, message: "Review inferred risk_level because semantic tool risk was not changed automatically." });
    }
  }

  doc.handoffs ??= [];
  if ((doc.handoffs as any[]).length === 0) {
    doc.handoffs.push({ name: "human_review", condition: "TODO: define handoff condition", destination: "queue:human-review", required_context: ["request_summary"] });
    result.applied.push({ code: "added-handoff-scaffold", path: "handoffs.0", message: "Added human_review handoff scaffold." });
    result.manualReviewRequired.push({ code: "review-handoff-condition", path: "handoffs.0.condition", message: "Replace TODO handoff condition with a domain-specific threshold." });
  }

  for (const [index, handoff] of (doc.handoffs as any[]).entries()) {
    if (!String(handoff.condition ?? "").trim()) {
      handoff.condition = "TODO: define handoff condition";
      result.applied.push({ code: "completed-handoff-placeholder", path: `handoffs.${index}.condition`, message: `Added TODO condition placeholder to handoff ${handoff.name ?? index}.` });
      result.manualReviewRequired.push({ code: "review-handoff-condition", path: `handoffs.${index}.condition`, message: "Define the actual handoff threshold before production use." });
    }
  }

  const firstHandoff = (doc.handoffs as any[])[0]?.name ?? "human_review";
  doc.routes ??= [];
  let hasFallback = false;
  for (const [index, route] of (doc.routes as any[]).entries()) {
    const routeText = `${route.name ?? ""} ${route.description ?? ""} ${(route.triggers ?? []).join(" ")}`;
    if (/fallback|unclear|policy gap/i.test(routeText) && String(route.target ?? "").startsWith("handoff:")) hasFallback = true;
    const target = String(route.target ?? "");
    if (target.startsWith("tool:")) {
      const toolName = target.slice("tool:".length);
      const exists = (doc.tools as any[]).some((tool) => tool.name === toolName);
      if (!exists) {
        route.target = `handoff:${firstHandoff}`;
        result.applied.push({ code: "retargeted-undefined-route-target", path: `routes.${index}.target`, message: `Retargeted route ${route.name ?? index} to handoff:${firstHandoff}.` });
        result.manualReviewRequired.push({ code: "review-route-target", path: `routes.${index}.target`, message: "Review retargeted route because undefined tool target was not semantically inferred." });
      }
    }
  }
  if (!hasFallback) {
    doc.routes.push({ name: `fallback_${firstHandoff}`, description: "agentlint_fixme: review fallback route scaffold", triggers: ["fallback", "unclear", "policy gap"], target: `handoff:${firstHandoff}`, priority: 100 });
    result.applied.push({ code: "added-fallback-scaffold", path: `routes.${doc.routes.length - 1}`, message: `Added fallback route scaffold to handoff:${firstHandoff}.` });
    result.manualReviewRequired.push({ code: "review-fallback-route", path: `routes.${doc.routes.length - 1}`, message: "Review fallback route triggers and target before production use." });
  }

  const escalation = doc.constraints?.escalation;
  if (Array.isArray(escalation)) {
    for (const [index, value] of escalation.entries()) {
      if (/try your best|use judge?ment|when needed|if needed|difficult/i.test(String(value))) {
        escalation[index] = `agentlint_fixme: review escalation wording - ${String(value).replace(/try your best|use judge?ment|when needed|if needed|difficult/gi, "formal threshold required")}`;
        result.applied.push({ code: "annotated-weak-escalation", path: `constraints.escalation.${index}`, message: "Annotated weak escalation wording without rewriting semantic intent." });
        result.manualReviewRequired.push({ code: "review-escalation-threshold", path: `constraints.escalation.${index}`, message: "Replace annotation with formal conditions such as amount >= 50 or confidence < 0.7." });
      }
    }
  }

  await writeFile(file, stringify(doc, { sortMapEntries: false }), "utf8");
  return result;
}

function formatFixResult(file: string, fix: FixResult, issues: Array<{ ruleId: string; message: string }>): string {
  const lines = [`${file}: autofix completed`, "", "Fixes applied"];
  lines.push(...(fix.applied.length ? fix.applied.map((item) => `  - ${item.message}`) : ["  - none"]));
  lines.push("", "Skipped fixes");
  lines.push(...(fix.skipped.length ? fix.skipped.map((item) => `  - ${item.message}`) : ["  - none"]));
  lines.push("", "Manual review required");
  lines.push(...(fix.manualReviewRequired.length ? fix.manualReviewRequired.map((item) => `  - ${item.message}`) : ["  - none"]));
  if (issues.length > 0) {
    lines.push("", "Remaining lint issues", ...issues.map((issue) => `  - ${issue.ruleId}: ${issue.message}`));
  }
  return `${lines.join("\n")}\n`;
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
    stderr: [],
    args
  };
  const program = createCli(state, programName);

  try {
    const parseArgs = args[0] === "lint" && args.includes("--fix") ? args.filter((arg) => arg !== "--fix") : args;
    await program.parseAsync(parseArgs, { from: "user" });
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

function formatCoverage(report: BehaviouralCoverageReport): string {
  const lines = [
    "Agent Lint Behavioural Coverage",
    `Overall: ${report.overall}%`,
    "",
    formatCoverageMetric("Route coverage", report.routeCoverage),
    formatCoverageMetric("Handoff coverage", report.handoffCoverage),
    formatCoverageMetric("Tool coverage", report.toolCoverage),
    formatCoverageMetric("Constraint coverage", report.constraintCoverage),
    formatCoverageMetric("Fallback coverage", report.fallbackCoverage),
    formatCoverageMetric("Test scenario coverage", report.testScenarioCoverage),
    "Uncovered branches",
    ...formatObjects(report.uncoveredBranches),
    "",
    "Recommended test scenarios",
    ...formatObjects(report.recommendedTestScenarios.map((scenario) => `${scenario.name}: ${scenario.reason}`)),
    ""
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

function formatCoverageMetric(title: string, metric: { total: number; covered: number; percentage: number; uncovered: string[] }): string {
  return `${title}: ${metric.percentage}% (${metric.covered}/${metric.total})${metric.uncovered.length ? `; uncovered: ${metric.uncovered.join(", ")}` : ""}`;
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

function formatCopilotDrift(report: CopilotStudioDriftReport): string {
  const lines = [
    "Copilot Studio Drift Report",
    "Status: experimental",
    `Solution: ${report.solutionPath}`,
    `Classification: ${report.classification}`,
    `Overall behavioural drift: ${report.scores.overallBehaviouralDrift}%`,
    "",
    "Scores",
    `  - Route drift: ${report.scores.routeDrift}%`,
    `  - Tool drift: ${report.scores.toolDrift}%`,
    `  - Handoff drift: ${report.scores.handoffDrift}%`,
    `  - Governance drift: ${report.scores.governanceDrift}%`,
    "",
    `Drift items: ${report.summary.driftCount}`,
    ""
  ];
  appendFindingList(lines, "Drift", report.items.map((item) => `${item.type}: ${item.name} - ${item.detail}`));
  appendFindingList(lines, "Remediation", report.remediation);
  return `${lines.join("\n").trimEnd()}\n`;
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
    `  Topics: ${formatList(report.extracted.topics.map((topic) => topic.name))}`,
    `  Actions: ${formatList(report.extracted.actions.map((action) => action.riskLevel ? `${action.name} (${action.riskLevel})` : action.name))}`,
    `  Flows: ${formatList(report.extracted.flows.map((flow) => flow.name))}`,
    `  Knowledge: ${formatList(report.extracted.knowledgeReferences.map((knowledge) => knowledge.name))}`,
    `  Handoffs: ${formatList(report.extracted.handoffs.map((handoff) => handoff.name))}`,
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

function formatReplay(result: ReplayResult): string {
  const lines = [
    "Agent Lint Scenario Replay",
    `Scenario: ${result.scenario}`,
    `Input: ${result.input}`,
    `Selected route: ${result.selectedRoute ?? "none"}`,
    "",
    "Decision path",
    ...result.decisionPath.map((item) => `  - ${item}`),
    "",
    "Triggered constraints",
    ...formatObjects(result.triggeredConstraints),
    "",
    "Tool eligibility checks",
    ...result.toolEligibilityChecks.map((check) => `  - ${check.tool}: ${check.eligible ? "eligible" : "not eligible"} (${check.reason})`),
    "",
    "Handoff reasoning",
    `  - ${result.handoffReasoning ?? "none"}`,
    "",
    "Trace",
    ...result.trace.map((step) => `  ${step.step}. ${step.kind} ${step.node}: ${step.result}`),
    ""
  ];
  return `${lines.join("\n").trimEnd()}\n`;
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
