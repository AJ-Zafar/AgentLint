import type { AgentSpecDocument, AgentSpecTool } from "@agentspec/spec";

export type LintRuleId =
  | "missing-primary-goal"
  | "conflicting-do-and-do-not"
  | "route-target-not-defined"
  | "handoff-without-condition"
  | "missing-fallback-route"
  | "tool-without-risk-level"
  | "high-risk-tool-without-auth"
  | "vague-instruction-language"
  | "duplicate-route-trigger"
  | "test-without-assertions"
  | "forbidden-operation-not-enforced"
  | "no-escalation-path";

export type LintIssueSeverity = "error" | "warning" | "info";

export type LintIssue = {
  ruleId: LintRuleId;
  severity: LintIssueSeverity;
  message: string;
  path: string;
  suggestion: string;
  confidence: number;
};

export type LintResult = {
  issues: LintIssue[];
};

export type LintRule = {
  ruleId: LintRuleId;
  run: (context: LintContext) => LintIssue[];
};

type ParsedTarget = { kind: "tool" | "handoff"; name: string };

type LintContext = {
  spec: AgentSpecDocument;
  routeNames: Set<string>;
  toolNames: Set<string>;
  handoffNames: Set<string>;
  routeTargets: Array<{ routeIndex: number; routeName: string; target: string; parsed?: ParsedTarget }>;
};

const vagueInstructionPatterns = [
  /\bbe careful\b/i,
  /\bdo the right thing\b/i,
  /\bbe helpful\b/i,
  /\buse (your )?best judgment\b/i,
  /\bappropriate\b/i,
  /\bas needed\b/i,
  /\bwhen possible\b/i,
  /\btry to\b/i
];

const fallbackPatterns = [/\bfallback\b/i, /\bdefault\b/i, /\bunclear\b/i, /\bunknown\b/i, /\bpolicy gap\b/i];

export const lintRules: LintRule[] = [
  {
    ruleId: "missing-primary-goal",
    run: ({ spec }) =>
      hasText(spec.instructions.primary_goal)
        ? []
        : [
            issue({
              ruleId: "missing-primary-goal",
              severity: "error",
              path: "instructions.primary_goal",
              message: "Instructions must define a primary goal.",
              suggestion: "Add instructions.primary_goal with one clear, testable objective for the agent.",
              confidence: 0.99
            })
          ]
  },
  {
    ruleId: "conflicting-do-and-do-not",
    run: ({ spec }) => {
      const forbidden = new Map(spec.instructions.do_not.map((instruction) => [normalizeInstruction(instruction), instruction]));
      const conflicts = spec.instructions.do
        .map((instruction, index) => ({ instruction, index, normalized: normalizeInstruction(instruction) }))
        .filter(({ normalized }) => normalized.length > 0 && forbidden.has(normalized));

      return conflicts.map(({ instruction, index }) =>
        issue({
          ruleId: "conflicting-do-and-do-not",
          severity: "error",
          path: `instructions.do.${index}`,
          message: `Instruction conflicts with do_not: "${instruction}".`,
          suggestion: "Remove the duplicate meaning from either instructions.do or instructions.do_not.",
          confidence: 0.95
        })
      );
    }
  },
  {
    ruleId: "route-target-not-defined",
    run: ({ routeTargets, toolNames, handoffNames }) =>
      routeTargets.flatMap(({ routeIndex, routeName, target, parsed }) => {
        if (!parsed) {
          return [
            issue({
              ruleId: "route-target-not-defined",
              severity: "error",
              path: `routes.${routeIndex}.target`,
              message: `Route "${routeName}" uses unsupported target "${target}".`,
              suggestion: "Use target format tool:<tool_name> or handoff:<handoff_name>.",
              confidence: 0.98
            })
          ];
        }

        const exists = parsed.kind === "tool" ? toolNames.has(parsed.name) : handoffNames.has(parsed.name);
        return exists
          ? []
          : [
              issue({
                ruleId: "route-target-not-defined",
                severity: "error",
                path: `routes.${routeIndex}.target`,
                message: `Route "${routeName}" targets undefined ${parsed.kind} "${parsed.name}".`,
                suggestion: `Define ${parsed.kind} "${parsed.name}" or update the route target to an existing ${parsed.kind}.`,
                confidence: 0.99
              })
            ];
      })
  },
  {
    ruleId: "handoff-without-condition",
    run: ({ spec }) =>
      spec.handoffs.flatMap((handoff, index) =>
        hasText(handoff.condition)
          ? []
          : [
              issue({
                ruleId: "handoff-without-condition",
                severity: "error",
                path: `handoffs.${index}.condition`,
                message: `Handoff "${handoff.name}" is missing a condition.`,
                suggestion: "Describe the exact situation that triggers this handoff.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "missing-fallback-route",
    run: ({ spec, routeTargets }) => {
      const hasFallbackRoute = spec.routes.some((route) => {
        const routeText = `${route.name} ${route.description} ${route.triggers.join(" ")}`;
        return fallbackPatterns.some((pattern) => pattern.test(routeText));
      });
      const hasHandoffTarget = routeTargets.some(({ parsed }) => parsed?.kind === "handoff");

      return hasFallbackRoute && hasHandoffTarget
        ? []
        : [
            issue({
              ruleId: "missing-fallback-route",
              severity: "warning",
              path: "routes",
              message: "No explicit fallback route targets a handoff for unclear or unmatched situations.",
              suggestion: "Add a low-priority fallback route with triggers like fallback/unclear and target handoff:<name>.",
              confidence: 0.88
            })
          ];
    }
  },
  {
    ruleId: "tool-without-risk-level",
    run: ({ spec }) =>
      spec.tools.flatMap((tool, index) =>
        hasText((tool as Partial<AgentSpecTool>).risk_level)
          ? []
          : [
              issue({
                ruleId: "tool-without-risk-level",
                severity: "warning",
                path: `tools.${index}.risk_level`,
                message: `Tool "${tool.name}" does not declare a risk level.`,
                suggestion: "Set risk_level to low, medium, high, or critical.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "high-risk-tool-without-auth",
    run: ({ spec }) =>
      spec.tools.flatMap((tool, index) =>
        (tool.risk_level === "high" || tool.risk_level === "critical") && !tool.requires_auth
          ? [
              issue({
                ruleId: "high-risk-tool-without-auth",
                severity: "error",
                path: `tools.${index}.requires_auth`,
                message: `High-risk tool "${tool.name}" does not require authentication.`,
                suggestion: "Set requires_auth: true or lower the risk level if authentication is not needed.",
                confidence: 0.97
              })
            ]
          : []
      )
  },
  {
    ruleId: "vague-instruction-language",
    run: ({ spec }) => {
      const candidates = [
        { path: "instructions.primary_goal", value: spec.instructions.primary_goal },
        ...spec.instructions.secondary_goals.map((value, index) => ({ path: `instructions.secondary_goals.${index}`, value })),
        ...spec.instructions.do.map((value, index) => ({ path: `instructions.do.${index}`, value })),
        ...spec.instructions.do_not.map((value, index) => ({ path: `instructions.do_not.${index}`, value }))
      ];

      return candidates.flatMap(({ path, value }) =>
        vagueInstructionPatterns.some((pattern) => pattern.test(value))
          ? [
              issue({
                ruleId: "vague-instruction-language",
                severity: "warning",
                path,
                message: `Instruction uses vague language: "${value}".`,
                suggestion: "Replace subjective phrasing with specific, observable behavior.",
                confidence: 0.86
              })
            ]
          : []
      );
    }
  },
  {
    ruleId: "duplicate-route-trigger",
    run: ({ spec }) => {
      const seen = new Map<string, { routeName: string; path: string }>();
      const issues: LintIssue[] = [];

      for (const [routeIndex, route] of spec.routes.entries()) {
        for (const [triggerIndex, trigger] of route.triggers.entries()) {
          const normalized = normalizeTrigger(trigger);
          const existing = seen.get(normalized);
          const path = `routes.${routeIndex}.triggers.${triggerIndex}`;

          if (existing) {
            issues.push(
              issue({
                ruleId: "duplicate-route-trigger",
                severity: "warning",
                path,
                message: `Trigger "${trigger}" is duplicated by routes "${existing.routeName}" and "${route.name}".`,
                suggestion: "Make route triggers distinct or consolidate the overlapping routes.",
                confidence: 0.94
              })
            );
          } else {
            seen.set(normalized, { routeName: route.name, path });
          }
        }
      }

      return issues;
    }
  },
  {
    ruleId: "test-without-assertions",
    run: ({ spec }) =>
      (spec.tests ?? []).flatMap((test, index) =>
        test.assertions.length > 0
          ? []
          : [
              issue({
                ruleId: "test-without-assertions",
                severity: "warning",
                path: `tests.${index}.assertions`,
                message: `Test "${test.name}" does not include assertions.`,
                suggestion: "Add assertions that describe required behavior or safety boundaries.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "forbidden-operation-not-enforced",
    run: ({ spec }) => {
      const enforcementText = normalizeInstruction(
        [
          ...spec.instructions.do_not,
          ...spec.constraints.safety,
          ...spec.constraints.privacy,
          ...spec.constraints.compliance,
          ...spec.constraints.data_access
        ].join(" ")
      );

      return spec.tools.flatMap((tool, toolIndex) =>
        tool.forbidden_operations.flatMap((operation, operationIndex) => {
          const normalizedOperation = normalizeOperation(operation);
          return enforcementText.includes(normalizedOperation)
            ? []
            : [
                issue({
                  ruleId: "forbidden-operation-not-enforced",
                  severity: "warning",
                  path: `tools.${toolIndex}.forbidden_operations.${operationIndex}`,
                  message: `Forbidden operation "${operation}" on tool "${tool.name}" is not reflected in instructions or constraints.`,
                  suggestion: "Add a matching do_not instruction or safety/privacy/data_access constraint that enforces this forbidden operation.",
                  confidence: 0.82
                })
              ];
        })
      );
    }
  },
  {
    ruleId: "no-escalation-path",
    run: ({ spec, routeTargets }) => {
      const hasEscalationConstraint = spec.constraints.escalation.some(hasText);
      const hasHandoff = spec.handoffs.length > 0;
      const hasRouteToHandoff = routeTargets.some(({ parsed }) => parsed?.kind === "handoff");

      return hasEscalationConstraint && hasHandoff && hasRouteToHandoff
        ? []
        : [
            issue({
              ruleId: "no-escalation-path",
              severity: "error",
              path: "handoffs",
              message: "AgentSpec does not define a complete escalation path.",
              suggestion: "Define escalation constraints, at least one handoff, and a route that targets handoff:<name>.",
              confidence: 0.93
            })
          ];
    }
  }
];

export function lintAgentSpec(spec: AgentSpecDocument, rules: LintRule[] = lintRules): LintResult {
  const context = createContext(spec);
  const issues = rules.flatMap((rule) => rule.run(context));

  return {
    issues: issues.sort(compareIssues)
  };
}

function createContext(spec: AgentSpecDocument): LintContext {
  return {
    spec,
    routeNames: new Set(spec.routes.map((route) => route.name)),
    toolNames: new Set(spec.tools.map((tool) => tool.name)),
    handoffNames: new Set(spec.handoffs.map((handoff) => handoff.name)),
    routeTargets: spec.routes.map((route, routeIndex) => ({
      routeIndex,
      routeName: route.name,
      target: route.target,
      parsed: parseTarget(route.target)
    }))
  };
}

function issue(issue: LintIssue): LintIssue {
  return issue;
}

function compareIssues(a: LintIssue, b: LintIssue): number {
  const severityOrder: Record<LintIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return severityOrder[a.severity] - severityOrder[b.severity] || a.path.localeCompare(b.path) || a.ruleId.localeCompare(b.ruleId);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeInstruction(instruction: string): string {
  return instruction
    .toLowerCase()
    .replace(/\b(do not|don't|never|must not|please|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOperation(operation: string): string {
  return normalizeInstruction(operation.replace(/_/g, " "));
}

function normalizeTrigger(trigger: string): string {
  return trigger.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseTarget(target: string): ParsedTarget | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();

  if ((kind === "tool" || kind === "handoff") && name.length > 0) {
    return { kind, name };
  }

  return undefined;
}
