import { Command, CommanderError } from "commander";
import { AgentSpecParseError, parseAgentSpecFile, type ParsedAgentSpec } from "@agentspec/parser";
import { lintAgentSpec } from "@agentspec/linter";
import { runAgentSpecTests, type TestRunResult } from "@agentspec/test-runner";
import { diffAgentSpecs, type BehavioralDiffResult } from "@agentspec/diff";
import { convertAgentSpecToCopilotStudioPlan } from "@agentspec/copilot-studio";

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

export function createCli(state: CliState): Command {
  const program = new Command();

  program
    .name("agentspec")
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

export async function runCli(args: string[]): Promise<CliResult> {
  const state: CliState = {
    exitCode: 0,
    stdout: [],
    stderr: []
  };
  const program = createCli(state);

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
