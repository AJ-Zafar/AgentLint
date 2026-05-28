import type { AgentSpecDocument } from "@agentspec/spec";

export type CoverageMetric = {
  total: number;
  covered: number;
  percentage: number;
  uncovered: string[];
};

export type BehaviouralCoverageReport = {
  overall: number;
  routeCoverage: CoverageMetric;
  handoffCoverage: CoverageMetric;
  toolCoverage: CoverageMetric;
  constraintCoverage: CoverageMetric;
  fallbackCoverage: CoverageMetric;
  testScenarioCoverage: CoverageMetric;
  uncoveredBranches: string[];
  recommendedTestScenarios: Array<{ name: string; reason: string }>;
};

export function analyseBehaviouralCoverage(spec: AgentSpecDocument): BehaviouralCoverageReport {
  const coveredRoutes = new Set<string>();
  const coveredHandoffs = new Set<string>();
  const coveredTools = new Set<string>();
  const coveredConstraints = new Set<string>();
  const coveredFallbacks = new Set<string>();

  for (const test of spec.tests ?? []) {
    if (test.expected_route) coveredRoutes.add(test.expected_route);
    if (test.expected_handoff) coveredHandoffs.add(test.expected_handoff);
    for (const tool of test.expected_tool_calls) coveredTools.add(tool);
    for (const assertion of test.assertions) collectAssertionCoverage(assertion, coveredRoutes, coveredHandoffs, coveredTools);
  }

  for (const scenario of spec.scenarios ?? []) {
    const input = scenario.input.toLowerCase();
    for (const route of spec.routes) {
      if (route.triggers.some((trigger) => input.includes(trigger.toLowerCase()))) {
        coveredRoutes.add(route.name);
        const target = parseTarget(route.target);
        if (target?.kind === "tool") coveredTools.add(target.name);
        if (target?.kind === "handoff") coveredHandoffs.add(target.name);
      }
    }
    for (const key of Object.keys(scenario.context)) {
      if (key === "authenticated" || key === "risk" || key === "confidence") coveredConstraints.add("evaluation");
    }
  }

  if (spec.tests?.some((test) => /privacy|secret|data/i.test(`${test.input} ${test.assertions.join(" ")}`))) coveredConstraints.add("privacy");
  if (spec.tests?.some((test) => /escalat|handoff|fallback/i.test(`${test.input} ${test.assertions.join(" ")}`))) coveredConstraints.add("escalation");
  if (spec.tests?.some((test) => /policy|compliance/i.test(`${test.input} ${test.assertions.join(" ")}`))) coveredConstraints.add("compliance");
  if (spec.tests?.some((test) => /safe|risk|harm/i.test(`${test.input} ${test.assertions.join(" ")}`))) coveredConstraints.add("safety");
  if (spec.tests?.some((test) => /tool|read|data|account/i.test(`${test.input} ${test.assertions.join(" ")}`))) coveredConstraints.add("data_access");

  for (const route of fallbackRoutes(spec)) {
    if (coveredRoutes.has(route.name)) coveredFallbacks.add(route.name);
  }

  const routeCoverage = metric(spec.routes.map((route) => route.name), coveredRoutes);
  const handoffCoverage = metric(spec.handoffs.map((handoff) => handoff.name), coveredHandoffs);
  const toolCoverage = metric(spec.tools.map((tool) => tool.name), coveredTools);
  const constraintCoverage = metric(constraintBranches(spec), coveredConstraints);
  const fallbackCoverage = metric(fallbackRoutes(spec).map((route) => route.name), coveredFallbacks);
  const testScenarioCoverage = metric(["tests", "scenarios"].filter((name) => name === "tests" ? (spec.tests?.length ?? 0) > 0 : (spec.scenarios?.length ?? 0) > 0), new Set([...(spec.tests?.length ? ["tests"] : []), ...(spec.scenarios?.length ? ["scenarios"] : [])]));
  const uncoveredBranches = [
    ...routeCoverage.uncovered.map((value) => `route:${value}`),
    ...handoffCoverage.uncovered.map((value) => `handoff:${value}`),
    ...toolCoverage.uncovered.map((value) => `tool:${value}`),
    ...constraintCoverage.uncovered.map((value) => `constraint:${value}`),
    ...fallbackCoverage.uncovered.map((value) => `fallback:${value}`)
  ];
  const recommendedTestScenarios = recommendations(routeCoverage, handoffCoverage, toolCoverage, constraintCoverage, fallbackCoverage);
  const metrics = [routeCoverage, handoffCoverage, toolCoverage, constraintCoverage, fallbackCoverage, testScenarioCoverage];

  return {
    overall: Math.round(metrics.reduce((sum, item) => sum + item.percentage, 0) / metrics.length),
    routeCoverage,
    handoffCoverage,
    toolCoverage,
    constraintCoverage,
    fallbackCoverage,
    testScenarioCoverage,
    uncoveredBranches,
    recommendedTestScenarios
  };
}

function collectAssertionCoverage(assertion: string, routes: Set<string>, handoffs: Set<string>, tools: Set<string>): void {
  const route = assertion.match(/^route is (.+)$/i)?.[1];
  if (route) routes.add(route.trim());
  const handoff = assertion.match(/^handoff is (.+)$/i)?.[1];
  if (handoff) handoffs.add(handoff.trim());
  const tool = assertion.match(/^(?:calls|uses) tool (.+)$/i)?.[1];
  if (tool) tools.add(tool.trim());
}

function metric(all: string[], covered: Set<string>): CoverageMetric {
  const unique = [...new Set(all)].sort();
  const coveredItems = unique.filter((item) => covered.has(item));
  const uncovered = unique.filter((item) => !covered.has(item));
  return { total: unique.length, covered: coveredItems.length, percentage: unique.length === 0 ? 100 : Math.round((coveredItems.length / unique.length) * 100), uncovered };
}

function constraintBranches(spec: AgentSpecDocument): string[] {
  return [
    spec.constraints.safety.length ? "safety" : undefined,
    spec.constraints.privacy.length ? "privacy" : undefined,
    spec.constraints.compliance.length ? "compliance" : undefined,
    spec.constraints.escalation.length ? "escalation" : undefined,
    spec.constraints.data_access.length ? "data_access" : undefined,
    spec.constraints.evaluation ? "evaluation" : undefined
  ].filter((item): item is string => Boolean(item));
}

function fallbackRoutes(spec: AgentSpecDocument) {
  return spec.routes.filter((route) => /fallback|unclear|policy gap/i.test(`${route.name} ${route.description} ${route.triggers.join(" ")}`));
}

function recommendations(routeCoverage: CoverageMetric, handoffCoverage: CoverageMetric, toolCoverage: CoverageMetric, constraintCoverage: CoverageMetric, fallbackCoverage: CoverageMetric): Array<{ name: string; reason: string }> {
  return [
    ...routeCoverage.uncovered.map((route) => ({ name: `cover-${route}`, reason: `Add a test or scenario that triggers route ${route}.` })),
    ...handoffCoverage.uncovered.map((handoff) => ({ name: `cover-${handoff}`, reason: `Add a test expecting handoff ${handoff}.` })),
    ...toolCoverage.uncovered.map((tool) => ({ name: `cover-${tool}`, reason: `Add a test expecting tool ${tool}.` })),
    ...constraintCoverage.uncovered.map((constraint) => ({ name: `cover-${constraint}`, reason: `Add a test or scenario covering constraint ${constraint}.` })),
    ...fallbackCoverage.uncovered.map((fallback) => ({ name: `cover-${fallback}`, reason: `Add a fallback test or scenario for ${fallback}.` }))
  ];
}

function parseTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();
  return (kind === "tool" || kind === "handoff") && name ? { kind, name } : undefined;
}
