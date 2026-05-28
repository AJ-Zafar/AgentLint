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
