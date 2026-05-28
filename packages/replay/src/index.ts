import type { AgentConditionExpression, AgentSpecDocument, AgentSpecRoute, AgentSpecScenario } from "@agentspec/spec";

export type ReplayTraceStep = {
  step: number;
  kind: "decision" | "constraint" | "route" | "tool" | "handoff" | "terminal";
  node: string;
  result: string;
};

export type ReplayResult = {
  scenario: string;
  input: string;
  decisionPath: string[];
  triggeredConstraints: string[];
  selectedRoute?: string;
  toolEligibilityChecks: Array<{ tool: string; eligible: boolean; reason: string }>;
  handoffReasoning?: string;
  trace: ReplayTraceStep[];
};

type Context = Record<string, string | number | boolean>;

export function replayScenario(spec: AgentSpecDocument, scenarioName: string): ReplayResult {
  const scenario = findScenario(spec, scenarioName);
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioName}`);
  }

  const trace: ReplayTraceStep[] = [];
  const decisionPath: string[] = [];
  const triggeredConstraints: string[] = [];
  let step = 1;

  if (spec.constraints.evaluation) {
    const result = evaluateExpression(spec.constraints.evaluation, scenario.context);
    decisionPath.push("constraint:evaluation");
    triggeredConstraints.push(...result.matched);
    trace.push({ step: step++, kind: "constraint", node: "constraint:evaluation", result: result.passed ? "passed" : "failed" });
  }

  let selectedRoute: AgentSpecRoute | undefined;
  let selectedCondition = "";
  for (const route of [...spec.routes].sort((a, b) => a.priority - b.priority)) {
    const decisionNode = `decision:${route.name}`;
    decisionPath.push(decisionNode);
    const evaluation = route.conditions ? evaluateExpression(route.conditions, scenario.context) : evaluateTriggers(route, scenario.input);
    triggeredConstraints.push(...evaluation.matched);
    trace.push({ step: step++, kind: "decision", node: decisionNode, result: evaluation.passed ? "matched" : "skipped" });

    if (evaluation.passed && !selectedRoute) {
      selectedRoute = route;
      selectedCondition = route.conditions ? formatCondition(route.conditions) : route.triggers.join(" OR ");
      break;
    }
  }

  const toolEligibilityChecks = spec.tools.map((tool) => ({ tool: tool.name, eligible: false, reason: "Selected route does not invoke this tool." }));
  let handoffReasoning: string | undefined;

  if (selectedRoute) {
    const routeNode = `route:${selectedRoute.name}`;
    decisionPath.push(routeNode);
    trace.push({ step: step++, kind: "route", node: routeNode, result: "selected" });
    const target = parseTarget(selectedRoute.target);
    if (target?.kind === "tool") {
      const check = toolEligibilityChecks.find((item) => item.tool === target.name);
      if (check) {
        check.eligible = true;
        check.reason = "Selected route invokes this tool.";
      }
      decisionPath.push(`tool:${target.name}`, `terminal:${selectedRoute.name}`);
      trace.push({ step: step++, kind: "tool", node: `tool:${target.name}`, result: "eligible" });
      trace.push({ step: step++, kind: "terminal", node: `terminal:${selectedRoute.name}`, result: "response" });
    } else if (target?.kind === "handoff") {
      decisionPath.push(`handoff:${target.name}`, `terminal:${selectedRoute.name}`);
      handoffReasoning = `Route ${selectedRoute.name} targets handoff ${target.name} because ${selectedCondition}.`;
      trace.push({ step: step++, kind: "handoff", node: `handoff:${target.name}`, result: "handoff" });
      trace.push({ step: step++, kind: "terminal", node: `terminal:${selectedRoute.name}`, result: "response" });
    }
  }

  return {
    scenario: scenario.name,
    input: scenario.input,
    decisionPath,
    triggeredConstraints: [...new Set(triggeredConstraints)],
    selectedRoute: selectedRoute?.name,
    toolEligibilityChecks,
    handoffReasoning,
    trace
  };
}

function findScenario(spec: AgentSpecDocument, scenarioName: string): AgentSpecScenario | undefined {
  const scenario = spec.scenarios?.find((item) => item.name === scenarioName);
  if (scenario) return scenario;
  const test = spec.tests?.find((item) => item.name === scenarioName);
  return test ? { name: test.name, input: test.input, context: {} } : undefined;
}

function evaluateTriggers(route: AgentSpecRoute, input: string): { passed: boolean; matched: string[] } {
  const lower = input.toLowerCase();
  const matched = route.triggers.filter((trigger) => lower.includes(trigger.toLowerCase()));
  return { passed: matched.length > 0, matched };
}

function evaluateExpression(expression: AgentConditionExpression, context: Context): { passed: boolean; matched: string[] } {
  if (typeof expression === "string") {
    const passed = evaluateCondition(expression, context);
    return { passed, matched: passed ? [expression] : [] };
  }
  if ("all" in expression) {
    const results = expression.all.map((item) => evaluateExpression(item, context));
    return { passed: results.every((item) => item.passed), matched: results.flatMap((item) => item.matched) };
  }
  if ("any" in expression) {
    const results = expression.any.map((item) => evaluateExpression(item, context));
    return { passed: results.some((item) => item.passed), matched: results.flatMap((item) => item.matched) };
  }
  const result = evaluateExpression(expression.not, context);
  return { passed: !result.passed, matched: result.passed ? [] : [`NOT (${formatCondition(expression.not)})`] };
}

function evaluateCondition(condition: string, context: Context): boolean {
  const match = condition.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (!match) return false;
  const [, field, operator, rawExpected] = match;
  const actual = context[field];
  const expected = parseValue(rawExpected);
  if (operator === "==") return actual === expected;
  if (operator === "!=") return actual !== expected;
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (operator === "<") return actual < expected;
  if (operator === "<=") return actual <= expected;
  if (operator === ">") return actual > expected;
  if (operator === ">=") return actual >= expected;
  return false;
}

function parseValue(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const number = Number(trimmed);
  return Number.isNaN(number) ? trimmed : number;
}

function parseTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();
  return (kind === "tool" || kind === "handoff") && name ? { kind, name } : undefined;
}

function formatCondition(expression: AgentConditionExpression): string {
  if (typeof expression === "string") return expression;
  if ("all" in expression) return expression.all.map(formatCondition).join(" AND ");
  if ("any" in expression) return expression.any.map(formatCondition).join(" OR ");
  return `NOT (${formatCondition(expression.not)})`;
}
