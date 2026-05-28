import { Command, CommanderError } from "commander";
import { parseAgentSpecFile } from "@agentspec/parser";
import { lintAgentSpec } from "@agentspec/linter";
import type { AgentSpecDocument } from "@agentspec/spec";

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
      for (const issue of result.issues) {
        state.stdout.push(`${issue.severity} ${issue.code} ${issue.path}: ${issue.message}\n`);
      }
    });

  program
    .command("test")
    .argument("<file>", "AgentSpec YAML file")
    .description("Run deterministic declared AgentSpec tests without live model calls.")
    .action(async (file: string) => {
      const parsed = await parseAgentSpecFile(file);
      const result = runDeclaredTests(parsed.document);

      for (const failure of result.failures) {
        state.stdout.push(`fail ${failure.id}: ${failure.message}\n`);
      }

      state.stdout.push(`${result.passed} passed, ${result.failed} failed\n`);
      if (result.failed > 0) {
        state.exitCode = 1;
      }
    });

  program
    .command("diff")
    .argument("<oldFile>", "Original AgentSpec YAML file")
    .argument("<newFile>", "Updated AgentSpec YAML file")
    .description("Show deterministic structural differences between two AgentSpec YAML files.")
    .action(async (oldFile: string, newFile: string) => {
      const [oldSpec, newSpec] = await Promise.all([parseAgentSpecFile(oldFile), parseAgentSpecFile(newFile)]);
      const changes = diffValues(oldSpec.document, newSpec.document);

      if (changes.length === 0) {
        state.stdout.push("No changes\n");
        return;
      }

      for (const change of changes) {
        state.stdout.push(`${change.path}: ${formatValue(change.before)} -> ${formatValue(change.after)}\n`);
      }
    });

  return program;
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

type DeclaredTestFailure = {
  id: string;
  message: string;
};

type DeclaredTestResult = {
  passed: number;
  failed: number;
  failures: DeclaredTestFailure[];
};

export function runDeclaredTests(spec: AgentSpecDocument): DeclaredTestResult {
  const routeIds = new Set(spec.routes.map((route) => route.id));
  const escalationIds = new Set(spec.escalations.map((escalation) => escalation.id));
  const toolIds = new Set(spec.tools.map((tool) => tool.id));
  const failures: DeclaredTestFailure[] = [];

  for (const test of spec.tests ?? []) {
    const messages: string[] = [];
    const simulatedRoute = simulateRoute(spec, test.input);
    const simulatedRouteId = simulatedRoute?.id ?? "none";

    if (test.expect.route) {
      if (!routeIds.has(test.expect.route)) {
        messages.push(`expected route "${test.expect.route}" is not defined`);
      } else if (simulatedRoute?.id !== test.expect.route) {
        messages.push(`expected route "${test.expect.route}" but simulated "${simulatedRouteId}"`);
      }
    }

    if (test.expect.escalation) {
      const simulatedEscalation = simulatedRoute?.escalateTo ?? "none";
      if (!escalationIds.has(test.expect.escalation)) {
        messages.push(`expected escalation "${test.expect.escalation}" is not defined`);
      } else if (simulatedRoute?.escalateTo !== test.expect.escalation) {
        messages.push(`expected escalation "${test.expect.escalation}" but simulated "${simulatedEscalation}"`);
      }
    }

    const simulatedTools = new Set(simulatedRoute?.tools ?? []);
    for (const toolId of test.expect.tools ?? []) {
      if (!toolIds.has(toolId)) {
        messages.push(`expected tool "${toolId}" is not defined`);
      } else if (!simulatedTools.has(toolId)) {
        messages.push(`expected tool "${toolId}" but simulated route "${simulatedRouteId}" does not use it`);
      }
    }

    if (messages.length > 0) {
      failures.push({
        id: test.id,
        message: messages.join("; ")
      });
    }
  }

  const total = spec.tests?.length ?? 0;
  return {
    passed: total - failures.length,
    failed: failures.length,
    failures
  };
}

function simulateRoute(spec: AgentSpecDocument, input: string): AgentSpecDocument["routes"][number] | undefined {
  const inputTokens = tokenize(input);
  let bestRoute: AgentSpecDocument["routes"][number] | undefined;
  let bestScore = 0;

  for (const route of spec.routes) {
    const routeTokens = tokenize(`${route.id} ${route.when}`);
    const score = [...inputTokens].filter((token) => routeTokens.has(token)).length;

    if (score > bestScore) {
      bestRoute = route;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestRoute : undefined;
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set([
    "a",
    "about",
    "an",
    "and",
    "are",
    "asks",
    "can",
    "customer",
    "i",
    "is",
    "need",
    "of",
    "or",
    "the",
    "this",
    "to"
  ]);

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.replace(/s$/, ""))
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
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
