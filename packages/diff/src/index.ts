import type { AgentSpecDocument, AgentSpecRiskLevel } from "@agentspec/spec";

export type ImpactLevel = "low" | "medium" | "high" | "breaking";

export type BehavioralChangeType =
  | "changed-primary-goal"
  | "changed-do-instructions"
  | "changed-do-not-instructions"
  | "added-tool"
  | "removed-tool"
  | "increased-tool-risk"
  | "changed-route-triggers"
  | "removed-fallback"
  | "changed-escalation-conditions"
  | "changed-handoff-destination"
  | "changed-tests";

export type BehavioralChange = {
  type: BehavioralChangeType;
  impact: ImpactLevel;
  path: string;
  message: string;
  before: unknown;
  after: unknown;
};

export type BehavioralDiffResult = {
  impact: ImpactLevel;
  changes: BehavioralChange[];
  summary: {
    total: number;
    low: number;
    medium: number;
    high: number;
    breaking: number;
  };
};

const riskRank: Record<AgentSpecRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

const impactRank: Record<ImpactLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  breaking: 3
};

export function diffAgentSpecs(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralDiffResult {
  const changes: BehavioralChange[] = [
    ...diffPrimaryGoal(oldSpec, newSpec),
    ...diffInstructions(oldSpec, newSpec),
    ...diffTools(oldSpec, newSpec),
    ...diffRoutes(oldSpec, newSpec),
    ...diffFallback(oldSpec, newSpec),
    ...diffEscalationConditions(oldSpec, newSpec),
    ...diffHandoffDestinations(oldSpec, newSpec),
    ...diffTests(oldSpec, newSpec)
  ];
  const summary = summarize(changes);

  return {
    impact: highestImpact(changes),
    changes,
    summary
  };
}

function diffPrimaryGoal(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  if (oldSpec.instructions.primary_goal === newSpec.instructions.primary_goal) {
    return [];
  }

  return [
    change(
      "changed-primary-goal",
      "high",
      "instructions.primary_goal",
      "Primary goal changed, which can alter the agent's core behavior.",
      oldSpec.instructions.primary_goal,
      newSpec.instructions.primary_goal
    )
  ];
}

function diffInstructions(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const changes: BehavioralChange[] = [];

  if (!sameStringArray(oldSpec.instructions.do, newSpec.instructions.do)) {
    changes.push(
      change(
        "changed-do-instructions",
        "medium",
        "instructions.do",
        "Allowed/required instructions changed.",
        oldSpec.instructions.do,
        newSpec.instructions.do
      )
    );
  }

  if (!sameStringArray(oldSpec.instructions.do_not, newSpec.instructions.do_not)) {
    changes.push(
      change(
        "changed-do-not-instructions",
        "high",
        "instructions.do_not",
        "Prohibited behavior instructions changed.",
        oldSpec.instructions.do_not,
        newSpec.instructions.do_not
      )
    );
  }

  return changes;
}

function diffTools(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const oldTools = byName(oldSpec.tools);
  const newTools = byName(newSpec.tools);
  const changes: BehavioralChange[] = [];

  for (const [name, tool] of newTools) {
    const oldTool = oldTools.get(name);
    if (!oldTool) {
      changes.push(change("added-tool", "medium", `tools.${name}`, `Tool "${name}" was added.`, undefined, tool));
      continue;
    }

    if (tool.risk_level && oldTool.risk_level && riskRank[tool.risk_level] > riskRank[oldTool.risk_level]) {
      changes.push(
        change(
          "increased-tool-risk",
          "high",
          `tools.${name}.risk_level`,
          `Tool "${name}" risk increased from ${oldTool.risk_level} to ${tool.risk_level}.`,
          oldTool.risk_level,
          tool.risk_level
        )
      );
    }
  }

  for (const [name, tool] of oldTools) {
    if (!newTools.has(name)) {
      changes.push(change("removed-tool", "breaking", `tools.${name}`, `Tool "${name}" was removed.`, tool, undefined));
    }
  }

  return changes;
}

function diffRoutes(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const oldRoutes = byName(oldSpec.routes);
  const newRoutes = byName(newSpec.routes);
  const changes: BehavioralChange[] = [];

  for (const [name, oldRoute] of oldRoutes) {
    const newRoute = newRoutes.get(name);
    if (!newRoute) {
      continue;
    }

    if (!sameStringArray(oldRoute.triggers, newRoute.triggers)) {
      changes.push(
        change(
          "changed-route-triggers",
          "high",
          `routes.${name}.triggers`,
          `Route "${name}" triggers changed, which can alter routing behavior.`,
          oldRoute.triggers,
          newRoute.triggers
        )
      );
    }
  }

  return changes;
}

function diffFallback(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const oldFallback = hasFallback(oldSpec);
  const newFallback = hasFallback(newSpec);

  if (oldFallback && !newFallback) {
    return [
      change(
        "removed-fallback",
        "breaking",
        "routes",
        "Fallback behavior was removed or no longer routes to a handoff.",
        describeFallback(oldSpec),
        describeFallback(newSpec)
      )
    ];
  }

  return [];
}

function diffEscalationConditions(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  if (sameStringArray(oldSpec.constraints.escalation, newSpec.constraints.escalation)) {
    return [];
  }

  const impact: ImpactLevel = oldSpec.constraints.escalation.length > 0 && newSpec.constraints.escalation.length === 0 ? "breaking" : "high";

  return [
    change(
      "changed-escalation-conditions",
      impact,
      "constraints.escalation",
      "Escalation conditions changed.",
      oldSpec.constraints.escalation,
      newSpec.constraints.escalation
    )
  ];
}

function diffHandoffDestinations(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const oldHandoffs = byName(oldSpec.handoffs);
  const newHandoffs = byName(newSpec.handoffs);
  const changes: BehavioralChange[] = [];

  for (const [name, oldHandoff] of oldHandoffs) {
    const newHandoff = newHandoffs.get(name);
    if (!newHandoff) {
      continue;
    }

    if (oldHandoff.destination !== newHandoff.destination) {
      changes.push(
        change(
          "changed-handoff-destination",
          "medium",
          `handoffs.${name}.destination`,
          `Handoff "${name}" destination changed.`,
          oldHandoff.destination,
          newHandoff.destination
        )
      );
    }
  }

  return changes;
}

function diffTests(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): BehavioralChange[] {
  const before = oldSpec.tests ?? [];
  const after = newSpec.tests ?? [];
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return [];
  }

  return [change("changed-tests", "low", "tests", "Declared AgentSpec tests changed.", before, after)];
}

function hasFallback(spec: AgentSpecDocument): boolean {
  return spec.routes.some((route) => {
    const target = parseTarget(route.target);
    const routeText = `${route.name} ${route.description} ${route.triggers.join(" ")}`.toLowerCase();
    return target?.kind === "handoff" && /fallback|unclear|unknown|policy gap/.test(routeText);
  });
}

function describeFallback(spec: AgentSpecDocument): string[] {
  return spec.routes
    .filter((route) => /fallback|unclear|unknown|policy gap/i.test(`${route.name} ${route.description} ${route.triggers.join(" ")}`))
    .map((route) => `${route.name} -> ${route.target}`);
}

function parseTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();

  if ((kind === "tool" || kind === "handoff") && name.length > 0) {
    return { kind, name };
  }

  return undefined;
}

function byName<T extends { name: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.name, item]));
}

function sameStringArray(left: string[], right: string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function change(
  type: BehavioralChangeType,
  impact: ImpactLevel,
  path: string,
  message: string,
  before: unknown,
  after: unknown
): BehavioralChange {
  return { type, impact, path, message, before, after };
}

function summarize(changes: BehavioralChange[]): BehavioralDiffResult["summary"] {
  return {
    total: changes.length,
    low: changes.filter((change) => change.impact === "low").length,
    medium: changes.filter((change) => change.impact === "medium").length,
    high: changes.filter((change) => change.impact === "high").length,
    breaking: changes.filter((change) => change.impact === "breaking").length
  };
}

function highestImpact(changes: BehavioralChange[]): ImpactLevel {
  return changes.reduce<ImpactLevel>(
    (highest, change) => (impactRank[change.impact] > impactRank[highest] ? change.impact : highest),
    "low"
  );
}


export type SimulatedImpactLevel = "low" | "moderate" | "significant" | "breaking";

export type SimulatedDiffReport = {
  impact: SimulatedImpactLevel;
  summary: {
    totalScenarios: number;
    changedScenarioCount: number;
    routeChangeRate: number;
  };
  routeSelectionChanges: Array<{ route: string; beforeProbability: number; afterProbability: number }>;
  escalationFrequencyChange: { before: number; after: number; delta: number };
  toolEligibilityChanges: Array<{ tool: string; beforeEligible: boolean; afterEligible: boolean }>;
  fallbackInvocationChange: { before: number; after: number; delta: number };
  constraintPrecedenceChanges: string[];
  impactedRoutes: string[];
  changedPaths: string[];
  newlyUnreachableStates: string[];
  likelyRegressionAreas: string[];
  scenarios: Array<{ input: string; before: ScenarioOutcome; after: ScenarioOutcome; changed: boolean }>;
};

export type ScenarioOutcome = {
  route?: string;
  handoff?: string;
  toolCalls: string[];
  fallback: boolean;
};

export function simulateAgentSpecDiff(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): SimulatedDiffReport {
  const staticDiff = diffAgentSpecs(oldSpec, newSpec);
  const scenarios = generateScenarios(oldSpec, newSpec).map((input) => {
    const before = simulateScenario(oldSpec, input);
    const after = simulateScenario(newSpec, input);
    return { input, before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
  });
  const total = scenarios.length || 1;
  const changedScenarioCount = scenarios.filter((scenario) => scenario.changed).length;
  const routeSelectionChanges = routeProbabilities(oldSpec, newSpec, scenarios);
  const escalationFrequencyChange = frequencyChange(scenarios, (outcome) => Boolean(outcome.handoff));
  const fallbackInvocationChange = frequencyChange(scenarios, (outcome) => outcome.fallback);
  const toolEligibilityChanges = toolChanges(oldSpec, newSpec);
  const constraintPrecedenceChanges = constraintChanges(oldSpec, newSpec);
  const changedPaths = staticDiff.changes.map((change) => change.path);
  const impactedRoutes = impactedRouteNames(staticDiff, scenarios);
  const newlyUnreachableStates = toolEligibilityChanges
    .filter((change) => change.beforeEligible && !change.afterEligible)
    .map((change) => `tool:${change.tool}`);
  const likelyRegressionAreas = regressionAreas({
    routeSelectionChanges,
    escalationFrequencyChange,
    fallbackInvocationChange,
    toolEligibilityChanges,
    constraintPrecedenceChanges,
    newlyUnreachableStates
  });

  return {
    impact: classifySimulatedImpact(staticDiff.impact, changedScenarioCount / total, likelyRegressionAreas),
    summary: {
      totalScenarios: scenarios.length,
      changedScenarioCount,
      routeChangeRate: round(changedScenarioCount / total)
    },
    routeSelectionChanges,
    escalationFrequencyChange,
    toolEligibilityChanges,
    fallbackInvocationChange,
    constraintPrecedenceChanges,
    impactedRoutes,
    changedPaths,
    newlyUnreachableStates,
    likelyRegressionAreas,
    scenarios
  };
}

function generateScenarios(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): string[] {
  const inputs = new Set<string>();
  for (const spec of [oldSpec, newSpec]) {
    for (const route of spec.routes) {
      for (const trigger of route.triggers) inputs.add(`Scenario for ${trigger}`);
    }
    for (const test of spec.tests ?? []) inputs.add(test.input);
  }
  return [...inputs].sort();
}

function simulateScenario(spec: AgentSpecDocument, input: string): ScenarioOutcome {
  const inputTokens = tokenize(input);
  let bestRoute: AgentSpecDocument["routes"][number] | undefined;
  let bestScore = 0;
  for (const route of [...spec.routes].sort((a, b) => a.priority - b.priority)) {
    const triggerTokens = tokenize(`${route.name} ${route.description} ${route.triggers.join(" ")}`);
    const score = [...inputTokens].filter((token) => triggerTokens.has(token)).length;
    if (score > bestScore) {
      bestRoute = route;
      bestScore = score;
    }
  }
  if (!bestRoute) return { toolCalls: [], fallback: false };
  const target = parseSimulationTarget(bestRoute.target);
  return {
    route: bestRoute.name,
    handoff: target?.kind === "handoff" ? target.name : inferHandoff(spec, input, bestRoute),
    toolCalls: target?.kind === "tool" ? [target.name] : [],
    fallback: /fallback|unclear|policy gap/i.test(`${bestRoute.name} ${bestRoute.description} ${bestRoute.triggers.join(" ")}`)
  };
}

function inferHandoff(spec: AgentSpecDocument, input: string, route: AgentSpecDocument["routes"][number]): string | undefined {
  const tokens = tokenize(`${input} ${route.description} ${route.triggers.join(" ")}`);
  let best: string | undefined;
  let score = 0;
  for (const handoff of spec.handoffs) {
    const handoffTokens = tokenize(`${handoff.name} ${handoff.condition}`);
    const nextScore = [...tokens].filter((token) => handoffTokens.has(token)).length;
    if (nextScore > score) {
      best = handoff.name;
      score = nextScore;
    }
  }
  return best;
}

function routeProbabilities(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument, scenarios: SimulatedDiffReport["scenarios"]): SimulatedDiffReport["routeSelectionChanges"] {
  const routes = new Set([...oldSpec.routes.map((route) => route.name), ...newSpec.routes.map((route) => route.name)]);
  return [...routes].sort().map((route) => {
    const beforeProbability = probability(scenarios, (scenario) => scenario.before.route === route);
    const afterProbability = probability(scenarios, (scenario) => scenario.after.route === route);
    return { route, beforeProbability, afterProbability };
  }).filter((change) => change.beforeProbability !== change.afterProbability);
}

function frequencyChange(scenarios: SimulatedDiffReport["scenarios"], predicate: (outcome: ScenarioOutcome) => boolean): { before: number; after: number; delta: number } {
  const before = probability(scenarios, (scenario) => predicate(scenario.before));
  const after = probability(scenarios, (scenario) => predicate(scenario.after));
  return { before, after, delta: round(after - before) };
}

function toolChanges(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): SimulatedDiffReport["toolEligibilityChanges"] {
  const oldTools = new Set(oldSpec.tools.map((tool) => tool.name));
  const newTools = new Set(newSpec.tools.map((tool) => tool.name));
  return [...new Set([...oldTools, ...newTools])].sort().map((tool) => ({ tool, beforeEligible: oldTools.has(tool), afterEligible: newTools.has(tool) })).filter((tool) => tool.beforeEligible !== tool.afterEligible);
}

function constraintChanges(oldSpec: AgentSpecDocument, newSpec: AgentSpecDocument): string[] {
  const changes: string[] = [];
  if (JSON.stringify(oldSpec.constraints.escalation) !== JSON.stringify(newSpec.constraints.escalation)) changes.push("constraints.escalation changed");
  if (JSON.stringify(oldSpec.precedence?.routes ?? []) !== JSON.stringify(newSpec.precedence?.routes ?? [])) changes.push("precedence.routes changed");
  return changes;
}

function impactedRouteNames(diff: BehavioralDiffResult, scenarios: SimulatedDiffReport["scenarios"]): string[] {
  const routes = new Set<string>();
  for (const change of diff.changes) {
    const match = change.path.match(/^routes\.([^.]+)/);
    if (match?.[1]) routes.add(match[1]);
  }
  for (const scenario of scenarios) {
    if (scenario.changed) {
      if (scenario.before.route) routes.add(scenario.before.route);
      if (scenario.after.route) routes.add(scenario.after.route);
    }
  }
  return [...routes].sort();
}

function regressionAreas(input: {
  routeSelectionChanges: unknown[];
  escalationFrequencyChange: { before: number; after: number };
  fallbackInvocationChange: { before: number; after: number };
  toolEligibilityChanges: Array<{ beforeEligible: boolean; afterEligible: boolean }>;
  constraintPrecedenceChanges: string[];
  newlyUnreachableStates: string[];
}): string[] {
  const areas = new Set<string>();
  if (input.routeSelectionChanges.length > 0) areas.add("route selection");
  if (input.escalationFrequencyChange.before !== input.escalationFrequencyChange.after) areas.add("escalation behaviour");
  if (input.fallbackInvocationChange.before !== input.fallbackInvocationChange.after) areas.add("fallback coverage");
  if (input.toolEligibilityChanges.length > 0) areas.add("tool eligibility");
  if (input.constraintPrecedenceChanges.length > 0) areas.add("constraint precedence");
  if (input.newlyUnreachableStates.length > 0) areas.add("unreachable states");
  return [...areas].sort();
}

function classifySimulatedImpact(staticImpact: ImpactLevel, routeChangeRate: number, regressionAreas: string[]): SimulatedImpactLevel {
  if (staticImpact === "breaking" || regressionAreas.includes("unreachable states")) return "breaking";
  if (routeChangeRate >= 0.5 || regressionAreas.length >= 3) return "significant";
  if (routeChangeRate > 0 || regressionAreas.length > 0) return "moderate";
  return "low";
}

function probability<T>(values: T[], predicate: (value: T) => boolean): number {
  return values.length === 0 ? 0 : round(values.filter(predicate).length / values.length);
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set(["for", "the", "and", "with", "this", "that", "scenario"]);
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).map((token) => token.replace(/s$/, "")).filter((token) => token.length > 2 && !stopWords.has(token)));
}

function parseSimulationTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();
  return (kind === "tool" || kind === "handoff") && name ? { kind, name } : undefined;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
