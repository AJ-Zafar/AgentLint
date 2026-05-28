import type { AgentSpecDocument } from "@agentspec/spec";

export type TestRunSummary = {
  total: number;
  passed: number;
  failed: number;
  score: number;
};

export type TestRunResult = {
  summary: TestRunSummary;
  tests: TestCaseResult[];
};

export type TestCaseResult = {
  name: string;
  passed: boolean;
  input: string;
  expected: TestExpectationSnapshot;
  actual: TestActualSnapshot;
  failures: TestFailure[];
  assertionResults: AssertionResult[];
};

export type TestExpectationSnapshot = {
  route?: string;
  handoff?: string;
  toolCalls: string[];
  forbiddenToolCalls: string[];
  assertions: string[];
};

export type TestActualSnapshot = {
  route?: string;
  handoff?: string;
  toolCalls: string[];
  routeScore: number;
  handoffScore: number;
};

export type TestFailure = {
  reason: string;
  expected: unknown;
  actual: unknown;
};

export type AssertionResult = {
  assertion: string;
  passed: boolean;
  reason?: string;
  expected?: unknown;
  actual?: unknown;
};

type ParsedTarget = { kind: "tool" | "handoff"; name: string };

type Simulation = {
  route?: AgentSpecDocument["routes"][number];
  handoff?: AgentSpecDocument["handoffs"][number];
  toolCalls: string[];
  routeScore: number;
  handoffScore: number;
};

export function runAgentSpecTests(spec: AgentSpecDocument): TestRunResult {
  const tests = (spec.tests ?? []).map((test): TestCaseResult => {
    const simulation = simulate(spec, test.input);
    const actual: TestActualSnapshot = {
      route: simulation.route?.name,
      handoff: simulation.handoff?.name,
      toolCalls: simulation.toolCalls,
      routeScore: simulation.routeScore,
      handoffScore: simulation.handoffScore
    };
    const expected: TestExpectationSnapshot = {
      route: test.expected_route,
      handoff: test.expected_handoff,
      toolCalls: test.expected_tool_calls,
      forbiddenToolCalls: test.forbidden_tool_calls,
      assertions: test.assertions
    };
    const failures = evaluateExpectations(expected, actual);
    const assertionResults = test.assertions.map((assertion) => evaluateAssertion(assertion, test.input, actual));

    for (const assertionResult of assertionResults) {
      if (!assertionResult.passed) {
        failures.push({
          reason: assertionResult.reason ?? "assertion-failed",
          expected: assertionResult.expected,
          actual: assertionResult.actual
        });
      }
    }

    return {
      name: test.name,
      passed: failures.length === 0,
      input: test.input,
      expected,
      actual,
      failures,
      assertionResults
    };
  });

  const passed = tests.filter((test) => test.passed).length;
  const total = tests.length;
  const failed = total - passed;

  return {
    summary: {
      total,
      passed,
      failed,
      score: total === 0 ? 100 : Math.round((passed / total) * 100)
    },
    tests
  };
}

function evaluateExpectations(expected: TestExpectationSnapshot, actual: TestActualSnapshot): TestFailure[] {
  const failures: TestFailure[] = [];

  if (expected.route && actual.route !== expected.route) {
    failures.push({ reason: "route-mismatch", expected: expected.route, actual: actual.route });
  }

  if (expected.handoff && actual.handoff !== expected.handoff) {
    failures.push({ reason: "handoff-mismatch", expected: expected.handoff, actual: actual.handoff });
  }

  for (const toolCall of expected.toolCalls) {
    if (!actual.toolCalls.includes(toolCall)) {
      failures.push({ reason: "missing-expected-tool-call", expected: toolCall, actual: actual.toolCalls });
    }
  }

  for (const toolCall of expected.forbiddenToolCalls) {
    if (actual.toolCalls.includes(toolCall)) {
      failures.push({ reason: "forbidden-tool-called", expected: `not ${toolCall}`, actual: actual.toolCalls });
    }
  }

  return failures;
}

function simulate(spec: AgentSpecDocument, input: string): Simulation {
  const routeMatch = inferRoute(spec, input);
  const route = routeMatch.route;
  const target = route ? parseTarget(route.target) : undefined;
  const toolCalls = target?.kind === "tool" && spec.tools.some((tool) => tool.name === target.name) ? [target.name] : [];
  const directHandoff = target?.kind === "handoff" ? spec.handoffs.find((handoff) => handoff.name === target.name) : undefined;
  const handoffMatch = directHandoff ? { handoff: directHandoff, score: 100 } : inferHandoff(spec, input, route);

  return {
    route,
    handoff: handoffMatch.handoff,
    toolCalls,
    routeScore: routeMatch.score,
    handoffScore: handoffMatch.score
  };
}

function inferRoute(spec: AgentSpecDocument, input: string): { route?: AgentSpecDocument["routes"][number]; score: number } {
  const inputTokens = tokenize(input);
  const rankedRoutes = [...spec.routes].sort((a, b) => a.priority - b.priority);
  let bestRoute: AgentSpecDocument["routes"][number] | undefined;
  let bestScore = 0;

  for (const route of rankedRoutes) {
    const triggerScore = route.triggers.reduce((score, trigger) => score + scoreTrigger(trigger, input, inputTokens), 0);
    const descriptionTokens = tokenize(`${route.name} ${route.description}`);
    const descriptionScore = [...inputTokens].filter((token) => descriptionTokens.has(token)).length;
    const score = triggerScore * 3 + descriptionScore;

    if (score > bestScore) {
      bestRoute = route;
      bestScore = score;
    }
  }

  return bestScore > 0 ? { route: bestRoute, score: bestScore } : { score: 0 };
}

function inferHandoff(
  spec: AgentSpecDocument,
  input: string,
  route?: AgentSpecDocument["routes"][number]
): { handoff?: AgentSpecDocument["handoffs"][number]; score: number } {
  const context = `${input} ${route?.name ?? ""} ${route?.description ?? ""} ${route?.triggers.join(" ") ?? ""}`;
  const contextTokens = tokenize(context);
  let bestHandoff: AgentSpecDocument["handoffs"][number] | undefined;
  let bestScore = 0;

  for (const handoff of spec.handoffs) {
    const handoffTokens = tokenize(`${handoff.name} ${handoff.condition}`);
    const score = [...contextTokens].filter((token) => handoffTokens.has(token)).length;

    if (score > bestScore) {
      bestHandoff = handoff;
      bestScore = score;
    }
  }

  return bestScore > 0 ? { handoff: bestHandoff, score: bestScore } : { score: 0 };
}

function evaluateAssertion(assertion: string, input: string, actual: TestActualSnapshot): AssertionResult {
  const normalized = assertion.trim();
  const lower = normalized.toLowerCase();

  const routeMatch = lower.match(/^route\s+is\s+(.+)$/);
  if (routeMatch) {
    const expected = routeMatch[1]?.trim();
    return result(assertion, actual.route === expected, "assertion-route-mismatch", expected, actual.route);
  }

  const handoffMatch = lower.match(/^handoff\s+is\s+(.+)$/);
  if (handoffMatch) {
    const expected = handoffMatch[1]?.trim();
    return result(assertion, actual.handoff === expected, "assertion-handoff-mismatch", expected, actual.handoff);
  }

  const callsToolMatch = lower.match(/^(calls|uses)\s+tool\s+(.+)$/);
  if (callsToolMatch) {
    const expected = callsToolMatch[2]?.trim() ?? "";
    return result(assertion, actual.toolCalls.includes(expected), "assertion-missing-tool-call", expected, actual.toolCalls);
  }

  const doesNotCallToolMatch = lower.match(/^does\s+not\s+(call|use)\s+tool\s+(.+)$/);
  if (doesNotCallToolMatch) {
    const forbidden = doesNotCallToolMatch[2]?.trim() ?? "";
    return result(assertion, !actual.toolCalls.includes(forbidden), "assertion-forbidden-tool-called", `not ${forbidden}`, actual.toolCalls);
  }

  const inputContainsMatch = lower.match(/^input\s+contains\s+(.+)$/);
  if (inputContainsMatch) {
    const expected = inputContainsMatch[1]?.trim() ?? "";
    return result(assertion, input.toLowerCase().includes(expected), "assertion-input-missing-text", expected, input);
  }

  return {
    assertion,
    passed: false,
    reason: "unsupported-assertion",
    expected: "route is <name> | handoff is <name> | calls tool <name> | does not call tool <name> | input contains <text>",
    actual: assertion
  };
}

function result(assertion: string, passed: boolean, reason: string, expected: unknown, actual: unknown): AssertionResult {
  return passed ? { assertion, passed } : { assertion, passed, reason, expected, actual };
}

function scoreTrigger(trigger: string, input: string, inputTokens: Set<string>): number {
  const normalizedTrigger = trigger.toLowerCase().trim();
  const normalizedInput = input.toLowerCase();
  if (normalizedInput.includes(normalizedTrigger)) {
    return Math.max(1, tokenize(trigger).size) + 2;
  }

  const triggerTokens = tokenize(trigger);
  return [...triggerTokens].filter((token) => inputTokens.has(token)).length;
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set([
    "a",
    "about",
    "an",
    "and",
    "are",
    "can",
    "for",
    "i",
    "is",
    "latest",
    "may",
    "my",
    "of",
    "or",
    "please",
    "the",
    "there",
    "this",
    "to",
    "was",
    "with"
  ]);

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.replace(/s$/, ""))
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
}

function parseTarget(target: string): ParsedTarget | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();

  if ((kind === "tool" || kind === "handoff") && name.length > 0) {
    return { kind, name };
  }

  return undefined;
}
