import { Command, CommanderError } from "commander";
import { parseAgentSpecFile } from "@agentspec/parser";
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
    .description("Validate an AgentSpec YAML file.")
    .action(async (file: string) => {
      await parseAgentSpecFile(file);
      state.stdout.push(`${file} is valid\n`);
    });

  program
    .command("lint")
    .argument("<file>", "AgentSpec YAML file")
    .description("Lint an AgentSpec YAML file for instruction-engineering issues.")
    .action(async (file: string) => {
      const parsed = await parseAgentSpecFile(file);
      const result = lintAgentSpec(parsed.document);

      if (result.issues.length === 0) {
        state.stdout.push(`${file}: no lint issues\n`);
        return;
      }

      state.exitCode = 1;
      state.stdout.push(formatLintIssues(result.issues));
    });

  program
    .command("test")
    .argument("<file>", "AgentSpec YAML file")
    .description("Run deterministic declared AgentSpec tests without live model calls.")
    .action(async (file: string) => {
      const parsed = await parseAgentSpecFile(file);
      const result = runAgentSpecTests(parsed.document);

      state.stdout.push(formatTestRun(result));
      if (result.summary.failed > 0) {
        state.exitCode = 1;
      }
    });

  program
    .command("copilot-plan")
    .argument("<file>", "AgentSpec YAML file")
    .description("Generate an experimental Microsoft Copilot Studio implementation plan.")
    .action(async (file: string) => {
      const parsed = await parseAgentSpecFile(file);
      state.stdout.push(convertAgentSpecToCopilotStudioPlan(parsed.document));
    });

  program
    .command("diff")
    .argument("<oldFile>", "Original AgentSpec YAML file")
    .argument("<newFile>", "Updated AgentSpec YAML file")
    .option("--json", "Emit machine-readable JSON output")
    .description("Report behavioral impact between two AgentSpec YAML files.")
    .action(async (oldFile: string, newFile: string, options: { json?: boolean }) => {
      const [oldSpec, newSpec] = await Promise.all([parseAgentSpecFile(oldFile), parseAgentSpecFile(newFile)]);
      const result = diffAgentSpecs(oldSpec.document, newSpec.document);

      state.stdout.push(options.json ? `${JSON.stringify(result, null, 2)}\n` : formatBehavioralDiff(result));
    });

  return program;
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
    state.exitCode = 1;
    if (error instanceof CommanderError) {
      if (error.message) {
        state.stderr.push(`${error.message}\n`);
      }
    } else if (error instanceof Error) {
      state.stderr.push(`${error.message}\n`);
    } else {
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
