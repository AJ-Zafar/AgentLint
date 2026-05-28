import type { AgentConditionExpression, AgentSpecDocument, AgentSpecRoute } from "@agentspec/spec";

export type GraphDiagnosticCode =
  | "invalid-operator"
  | "circular-dependency"
  | "unreachable-branch"
  | "conflicting-precedence"
  | "dead-end-state"
  | "unreachable-node"
  | "isolated-route";

export type GraphDiagnostic = {
  code: GraphDiagnosticCode;
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type BehaviourGraphNodeKind = "route" | "decision" | "tool" | "constraint" | "handoff" | "fallback" | "terminal_response";
export type BehaviourGraphEdgeKind = "conditional_transition" | "precedence_branch" | "escalation_path" | "tool_invocation_path" | "terminal_transition" | "constraint_gate";

export type BehaviourGraphNode = {
  id: string;
  kind: BehaviourGraphNodeKind;
  label: string;
};

export type BehaviourGraphEdge = {
  from: string;
  to: string;
  kind: BehaviourGraphEdgeKind;
  label?: string;
};

export type BehaviourGraph = {
  nodes: BehaviourGraphNode[];
  edges: BehaviourGraphEdge[];
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
  const nodes: BehaviourGraphNode[] = [];
  const edges: BehaviourGraphEdge[] = [];

  if (spec.constraints.evaluation) {
    nodes.push({ id: "constraint:evaluation", kind: "constraint", label: "Constraint evaluation" });
    collectConditions(spec.constraints.evaluation, "constraints.evaluation", diagnostics);
  }

  for (const route of spec.routes) {
    nodes.push({ id: routeNodeId(route), kind: isFallbackRoute(route) ? "fallback" : "route", label: route.name });
    nodes.push({ id: decisionNodeId(route), kind: "decision", label: `${route.name} decision` });
    nodes.push({ id: terminalNodeId(route), kind: "terminal_response", label: `${route.name} response` });
  }

  nodes.push(...spec.tools.map((tool) => ({ id: `tool:${tool.name}`, kind: "tool" as const, label: tool.name })));
  nodes.push(...spec.handoffs.map((handoff) => ({ id: `handoff:${handoff.name}`, kind: "handoff" as const, label: handoff.name })));

  for (const [routeIndex, route] of spec.routes.entries()) {
    const conditionLabel = route.conditions ? formatCondition(route.conditions) : route.triggers.join(" OR ");
    const decisionId = decisionNodeId(route);
    const routeId = routeNodeId(route);

    edges.push({ from: decisionId, to: routeId, kind: "conditional_transition", label: conditionLabel });

    if (spec.constraints.evaluation) {
      edges.push({ from: "constraint:evaluation", to: decisionId, kind: "constraint_gate", label: formatCondition(spec.constraints.evaluation) });
    }

    const target = parseTarget(route.target);
    if (target?.kind === "tool") {
      edges.push({ from: routeId, to: `tool:${target.name}`, kind: "tool_invocation_path", label: "invoke" });
      edges.push({ from: `tool:${target.name}`, to: terminalNodeId(route), kind: "terminal_transition", label: "respond" });
    } else if (target?.kind === "handoff") {
      edges.push({ from: routeId, to: `handoff:${target.name}`, kind: "escalation_path", label: "handoff" });
      edges.push({ from: `handoff:${target.name}`, to: terminalNodeId(route), kind: "terminal_transition", label: "respond" });
    } else {
      diagnostics.push({ code: "dead-end-state", severity: "error", path: `routes.${routeIndex}.target`, message: `Route "${route.name}" has no valid tool or handoff target.` });
    }

    for (const dependency of route.depends_on ?? []) {
      edges.push({ from: routeNodeIdByName(dependency), to: routeId, kind: "precedence_branch", label: "depends_on" });
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

    if ((route.triggers.length === 0 && !route.conditions) || conditionLabel.trim().length === 0) {
      diagnostics.push({ code: "isolated-route", severity: "warning", path: `routes.${routeIndex}`, message: `Route "${route.name}" has no triggers or conditions.` });
    }
  }

  for (let index = 1; index < precedence.length; index += 1) {
    edges.push({ from: routeNodeIdByName(precedence[index - 1]), to: routeNodeIdByName(precedence[index]), kind: "precedence_branch", label: "precedes" });
  }

  const graph = { nodes: sortNodes(nodes), edges: sortEdges(edges), precedence };
  diagnostics.push(...validateDependencies(spec));
  diagnostics.push(...validatePrecedence(spec, precedence));
  diagnostics.push(...validateReachability(spec, graph));
  diagnostics.push(...validateDeadEnds(graph));

  return { graph, diagnostics: dedupeDiagnostics(sortDiagnostics(diagnostics)) };
}

function collectConditions(expression: AgentConditionExpression, path: string, diagnostics: GraphDiagnostic[]): ParsedCondition[] {
  if (typeof expression === "string") {
    const match = expression.match(operatorPattern);
    if (!match?.groups || !validOperators.has(match.groups.operator)) {
      diagnostics.push({ code: "invalid-operator", severity: "error", path, message: `Condition "${expression}" must use one of: ==, !=, <, <=, >, >=.` });
      return [];
    }
    return [{ field: match.groups.field, operator: match.groups.operator, value: match.groups.value.trim(), raw: expression, path }];
  }
  if ("all" in expression) return expression.all.flatMap((child, index) => collectConditions(child, `${path}.all.${index}`, diagnostics));
  if ("any" in expression) return expression.any.flatMap((child, index) => collectConditions(child, `${path}.any.${index}`, diagnostics));
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
    if (values.size > 1) return true;
    for (const value of values) if (notEquals.get(field)?.has(value)) return true;
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
      diagnostics.push({ code: "circular-dependency", severity: "error", path: "routes.depends_on", message: `Circular route dependency detected: ${[...stack, route].join(" -> ")}.` });
      return;
    }
    if (visited.has(route)) return;
    visiting.add(route);
    for (const dep of dependencyMap.get(route) ?? []) if (dependencyMap.has(dep)) visit(dep, [...stack, route]);
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
    if (seen.has(route)) diagnostics.push({ code: "conflicting-precedence", severity: "error", path: `precedence.routes.${index}`, message: `Route "${route}" appears more than once in precedence.` });
    if (!routeNames.has(route)) diagnostics.push({ code: "conflicting-precedence", severity: "error", path: `precedence.routes.${index}`, message: `Precedence references unknown route "${route}".` });
    seen.add(route);
  }
  for (let index = 1; index < precedence.length; index += 1) {
    const previous = precedence[index - 1];
    const current = precedence[index];
    const previousPriority = priority.get(previous);
    const currentPriority = priority.get(current);
    if (previousPriority !== undefined && currentPriority !== undefined && previousPriority > currentPriority) {
      diagnostics.push({ code: "conflicting-precedence", severity: "warning", path: `precedence.routes.${index}`, message: `Precedence places "${previous}" before "${current}" despite a lower numeric priority.` });
      break;
    }
  }
  return diagnostics;
}

function validateReachability(spec: AgentSpecDocument, graph: BehaviourGraph): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [];
  const targets = new Set(graph.edges.map((edge) => edge.to));
  for (const tool of spec.tools) if (!targets.has(`tool:${tool.name}`)) diagnostics.push({ code: "unreachable-node", severity: "warning", path: "tools", message: `Tool "${tool.name}" is not reachable from any route.` });
  for (const handoff of spec.handoffs) if (!targets.has(`handoff:${handoff.name}`)) diagnostics.push({ code: "unreachable-node", severity: "warning", path: "handoffs", message: `Handoff "${handoff.name}" is not reachable from any route.` });
  return diagnostics;
}

function validateDeadEnds(graph: BehaviourGraph): GraphDiagnostic[] {
  const outgoing = new Map<string, number>();
  for (const edge of graph.edges) outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  return graph.nodes
    .filter((node) => !["terminal_response", "tool", "handoff"].includes(node.kind) && (outgoing.get(node.id) ?? 0) === 0)
    .map((node) => ({ code: "dead-end-state" as const, severity: "error" as const, path: node.id, message: `Graph node "${node.id}" has no outgoing transition.` }));
}

function formatCondition(expression: AgentConditionExpression): string {
  if (typeof expression === "string") return expression;
  if ("all" in expression) return expression.all.map(formatCondition).join(" AND ");
  if ("any" in expression) return expression.any.map(formatCondition).join(" OR ");
  return `NOT (${formatCondition(expression.not)})`;
}

function parseTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();
  return (kind === "tool" || kind === "handoff") && name ? { kind, name } : undefined;
}

function isFallbackRoute(route: AgentSpecRoute): boolean {
  return /fallback|unclear|policy gap/i.test(`${route.name} ${route.description} ${route.triggers.join(" ")}`);
}

function routeNodeId(route: AgentSpecRoute): string { return routeNodeIdByName(route.name); }
function routeNodeIdByName(name: string): string { return `route:${name}`; }
function decisionNodeId(route: AgentSpecRoute): string { return `decision:${route.name}`; }
function terminalNodeId(route: AgentSpecRoute): string { return `terminal:${route.name}`; }

function sortNodes(nodes: BehaviourGraphNode[]): BehaviourGraphNode[] { return nodes.sort((a, b) => a.id.localeCompare(b.id)); }
function sortEdges(edges: BehaviourGraphEdge[]): BehaviourGraphEdge[] { return edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind)); }
function sortDiagnostics(diagnostics: GraphDiagnostic[]): GraphDiagnostic[] { return diagnostics.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)); }
function dedupeDiagnostics(diagnostics: GraphDiagnostic[]): GraphDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}:${diagnostic.path}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
