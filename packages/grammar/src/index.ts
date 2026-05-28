import type { AgentConditionExpression, AgentSpecDocument } from "@agentspec/spec";

export type GraphDiagnosticCode =
  | "invalid-operator"
  | "circular-dependency"
  | "unreachable-branch"
  | "conflicting-precedence";

export type GraphDiagnostic = {
  code: GraphDiagnosticCode;
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type BehaviourGraph = {
  nodes: Array<{ id: string; kind: "start" | "route" | "tool" | "handoff"; label: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
  precedence: string[];
};

export type GraphCompilationResult = {
  graph: BehaviourGraph;
  diagnostics: GraphDiagnostic[];
};

type ParsedCondition = { field: string; operator: string; value: string; raw: string; path: string };

const validOperators = new Set(["==", "!=", "<", "<=", ">", ">="]);
const operatorPattern = /^(?<field>[A-Za-z_][A-Za-z0-9_.-]*)\s*(?<operator>===|!==|==|!=|<=|>=|<|>)\s*(?<value>.+)$/;

export function compileAgentSpecGraph(spec: AgentSpecDocument): GraphCompilationResult {
  const diagnostics: GraphDiagnostic[] = [];
  const precedence = spec.precedence?.routes ?? [...spec.routes].sort((a, b) => a.priority - b.priority).map((route) => route.name);
  const graph: BehaviourGraph = {
    nodes: [
      { id: "start", kind: "start", label: "Start" },
      ...spec.routes.map((route) => ({ id: `route:${route.name}`, kind: "route" as const, label: route.name })),
      ...spec.tools.map((tool) => ({ id: `tool:${tool.name}`, kind: "tool" as const, label: tool.name })),
      ...spec.handoffs.map((handoff) => ({ id: `handoff:${handoff.name}`, kind: "handoff" as const, label: handoff.name }))
    ],
    edges: [],
    precedence
  };

  for (const [routeIndex, route] of spec.routes.entries()) {
    const routeId = `route:${route.name}`;
    graph.edges.push({ from: "start", to: routeId, label: route.conditions ? formatCondition(route.conditions) : route.triggers.join(" OR ") });

    const [kind, name] = route.target.split(":");
    if ((kind === "tool" || kind === "handoff") && name) {
      graph.edges.push({ from: routeId, to: `${kind}:${name}`, label: "target" });
    }

    for (const dependency of route.depends_on ?? []) {
      graph.edges.push({ from: `route:${dependency}`, to: routeId, label: "depends_on" });
    }

    if (route.conditions) {
      const parsed = collectConditions(route.conditions, `routes.${routeIndex}.conditions`, diagnostics);
      if (hasContradiction(parsed)) {
        diagnostics.push({
          code: "unreachable-branch",
          severity: "error",
          path: `routes.${routeIndex}.conditions`,
          message: `Route "${route.name}" has contradictory all conditions and cannot be reached.`
        });
      }
    }
  }

  if (spec.constraints.evaluation) {
    collectConditions(spec.constraints.evaluation, "constraints.evaluation", diagnostics);
  }

  diagnostics.push(...validateDependencies(spec));
  diagnostics.push(...validatePrecedence(spec, precedence));

  return { graph, diagnostics: sortDiagnostics(diagnostics) };
}

function collectConditions(expression: AgentConditionExpression, path: string, diagnostics: GraphDiagnostic[]): ParsedCondition[] {
  if (typeof expression === "string") {
    const match = expression.match(operatorPattern);
    if (!match?.groups || !validOperators.has(match.groups.operator)) {
      diagnostics.push({
        code: "invalid-operator",
        severity: "error",
        path,
        message: `Condition "${expression}" must use one of: ==, !=, <, <=, >, >=.`
      });
      return [];
    }

    return [{ field: match.groups.field, operator: match.groups.operator, value: match.groups.value.trim(), raw: expression, path }];
  }

  if ("all" in expression) {
    return expression.all.flatMap((child, index) => collectConditions(child, `${path}.all.${index}`, diagnostics));
  }
  if ("any" in expression) {
    return expression.any.flatMap((child, index) => collectConditions(child, `${path}.any.${index}`, diagnostics));
  }

  return collectConditions(expression.not, `${path}.not`, diagnostics);
}

function hasContradiction(conditions: ParsedCondition[]): boolean {
  const equals = new Map<string, Set<string>>();
  const notEquals = new Map<string, Set<string>>();

  for (const condition of conditions) {
    if (condition.operator === "==") {
      const values = equals.get(condition.field) ?? new Set<string>();
      values.add(condition.value);
      equals.set(condition.field, values);
    }
    if (condition.operator === "!=") {
      const values = notEquals.get(condition.field) ?? new Set<string>();
      values.add(condition.value);
      notEquals.set(condition.field, values);
    }
  }

  for (const [field, values] of equals) {
    if (values.size > 1) {
      return true;
    }
    for (const value of values) {
      if (notEquals.get(field)?.has(value)) {
        return true;
      }
    }
  }

  return false;
}

function validateDependencies(spec: AgentSpecDocument): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [];
  const dependencyMap = new Map(spec.routes.map((route) => [route.name, route.depends_on ?? []]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(route: string, stack: string[]): void {
    if (visiting.has(route)) {
      diagnostics.push({
        code: "circular-dependency",
        severity: "error",
        path: "routes.depends_on",
        message: `Circular route dependency detected: ${[...stack, route].join(" -> ")}.`
      });
      return;
    }
    if (visited.has(route)) return;

    visiting.add(route);
    for (const dep of dependencyMap.get(route) ?? []) {
      if (dependencyMap.has(dep)) visit(dep, [...stack, route]);
    }
    visiting.delete(route);
    visited.add(route);
  }

  for (const route of dependencyMap.keys()) visit(route, []);
  return diagnostics.slice(0, 1);
}

function validatePrecedence(spec: AgentSpecDocument, precedence: string[]): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [];
  const routeNames = new Set(spec.routes.map((route) => route.name));
  const seen = new Set<string>();
  const priority = new Map(spec.routes.map((route) => [route.name, route.priority]));

  for (const [index, route] of precedence.entries()) {
    if (seen.has(route)) {
      diagnostics.push({ code: "conflicting-precedence", severity: "error", path: `precedence.routes.${index}`, message: `Route "${route}" appears more than once in precedence.` });
    }
    if (!routeNames.has(route)) {
      diagnostics.push({ code: "conflicting-precedence", severity: "error", path: `precedence.routes.${index}`, message: `Precedence references unknown route "${route}".` });
    }
    seen.add(route);
  }

  for (let index = 1; index < precedence.length; index += 1) {
    const previous = precedence[index - 1];
    const current = precedence[index];
    const previousPriority = priority.get(previous);
    const currentPriority = priority.get(current);
    if (previousPriority !== undefined && currentPriority !== undefined && previousPriority > currentPriority) {
      diagnostics.push({
        code: "conflicting-precedence",
        severity: "warning",
        path: `precedence.routes.${index}`,
        message: `Precedence places "${previous}" before "${current}" despite a lower numeric priority.`
      });
      break;
    }
  }

  return diagnostics;
}

function formatCondition(expression: AgentConditionExpression): string {
  if (typeof expression === "string") return expression;
  if ("all" in expression) return expression.all.map(formatCondition).join(" AND ");
  if ("any" in expression) return expression.any.map(formatCondition).join(" OR ");
  return `NOT (${formatCondition(expression.not)})`;
}

function sortDiagnostics(diagnostics: GraphDiagnostic[]): GraphDiagnostic[] {
  return diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
}
